package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
	"tracker-backend/internal/notify"
)

const (
	defaultOrdersPageSize = 20
	maxOrdersPageSize     = 100
)

// orderSortOptions maps a ?sort= value to an ORDER BY clause. id is always
// the final tiebreaker so pagination stays stable even when many rows share
// the same due_date/value.
var orderSortOptions = map[string]string{
	"newest":     "orders.created_at desc, orders.id desc",
	"oldest":     "orders.created_at asc, orders.id asc",
	"due_asc":    "orders.due_date asc, orders.id desc",
	"due_desc":   "orders.due_date desc, orders.id desc",
	"value_asc":  "orders.value asc, orders.id desc",
	"value_desc": "orders.value desc, orders.id desc",
}

type OrderHandler struct {
	DB *gorm.DB
}

func NewOrderHandler(db *gorm.DB) *OrderHandler {
	return &OrderHandler{DB: db}
}

// redactPriceList clears PriceListName for anyone but a manager — sales
// picks products off their assigned price list but never sees its name,
// and manufacturing fulfills orders without needing to know pricing
// context either. Applied at the handler layer (not left to the frontend
// to simply not render) since the field would otherwise still be sitting
// in the JSON response for anyone to read via devtools.
func redactPriceList(role any, orders []models.Order) {
	if role == string(models.RoleManager) {
		return
	}
	for i := range orders {
		orders[i].PriceListName = ""
	}
}

func redactPriceListOne(role any, order *models.Order) {
	if role == string(models.RoleManager) {
		return
	}
	order.PriceListName = ""
}

// List returns a page of orders visible to the authenticated user (newest
// first by default). Supports ?search= (matches ticket number, client name,
// or any item's product name), ?status= (a stored OrderStatus value, or the
// derived "delayed" status), ?customerId=, ?dateFrom=/?dateTo= (inclusive
// due_date range, YYYY-MM-DD), ?sort= (see orderSortOptions), and
// ?limit=/?offset= for pagination — filtering, sorting, and paging all
// happen in SQL, not in the frontend, so the query stays fast and bounded
// no matter how large an account's order history grows. The response
// includes the total matching count so the client knows how much more is
// left to page through.
func (h *OrderHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	role, _ := c.Get(middleware.RoleKey)
	search := strings.TrimSpace(c.Query("search"))
	status := strings.TrimSpace(c.Query("status"))

	limit := defaultOrdersPageSize
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= maxOrdersPageSize {
		limit = l
	}
	offset := 0
	if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
		offset = o
	}

	orderBy, ok := orderSortOptions[c.Query("sort")]
	if !ok {
		orderBy = orderSortOptions["newest"]
	}

	// baseQuery is rebuilt fresh for the count and the page fetch so that
	// chaining Order/Limit/Offset onto one of them can't leak into the
	// other via GORM's shared statement builder.
	baseQuery := func() *gorm.DB {
		q := h.DB.Model(&models.Order{})
		// Sales only sees their own orders; manufacturing/manager need to
		// see every sales rep's orders to fulfill and update them.
		if role == string(models.RoleSales) {
			q = q.Where("orders.created_by_id = ?", userID)
		}

		if search != "" {
			like := "%" + strings.ToLower(search) + "%"
			q = q.Where(
				"LOWER(orders.ticket_number) LIKE ? OR LOWER(orders.client_name) LIKE ? OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id AND LOWER(oi.product_name) LIKE ?)",
				like, like, like,
			)
		}

		if customerID, err := strconv.Atoi(c.Query("customerId")); err == nil && customerID > 0 {
			q = q.Where("orders.customer_id = ?", customerID)
		}

		if dateFrom, err := time.Parse("2006-01-02", c.Query("dateFrom")); err == nil {
			q = q.Where("orders.due_date >= ?", dateFrom)
		}
		if dateTo, err := time.Parse("2006-01-02", c.Query("dateTo")); err == nil {
			q = q.Where("orders.due_date < ?", dateTo.AddDate(0, 0, 1))
		}

		// pending, approved, and rejected are the top-level "super states" a
		// sales rep or manufacturing thinks in terms of. approved is really a
		// family of statuses — everything past the approval gate — with its
		// own sub-states (in_progress, dispatched, delayed, delivered)
		// selectable individually via the same param.
		switch status {
		case "":
			// no status filter
		case "approved":
			q = q.Where(
				"orders.status IN ?",
				[]models.OrderStatus{models.OrderStatusApproved, models.OrderStatusInProgress, models.OrderStatusDispatched, models.OrderStatusDelivered},
			)
		case "delayed":
			q = q.Where(
				"orders.status IN ? AND orders.due_date < ?",
				[]models.OrderStatus{models.OrderStatusApproved, models.OrderStatusInProgress, models.OrderStatusDispatched}, time.Now(),
			)
		default:
			q = q.Where("orders.status = ?", status)
		}

		return q
	}

	var total int64
	if err := baseQuery().Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load orders"})
		return
	}

	var orders []models.Order
	if err := baseQuery().Preload("Items").Order(orderBy).Limit(limit).Offset(offset).Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load orders"})
		return
	}

	redactPriceList(role, orders)
	c.JSON(http.StatusOK, gin.H{"orders": orders, "total": total})
}

// Priority returns the authenticated user's priority queue for the Sales
// dashboard: urgent orders first (capped at 5, soonest due date first), then
// all high-urgency orders (also soonest due date first).
func (h *OrderHandler) Priority(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var urgentOrders []models.Order
	if err := h.DB.Preload("Items").
		Where("created_by_id = ? AND urgency = ?", userID, models.OrderUrgencyUrgent).
		Order("due_date asc").
		Limit(5).
		Find(&urgentOrders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load priority orders"})
		return
	}

	var highOrders []models.Order
	if err := h.DB.Preload("Items").
		Where("created_by_id = ? AND urgency = ?", userID, models.OrderUrgencyHigh).
		Order("due_date asc").
		Find(&highOrders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load priority orders"})
		return
	}

	orders := append(urgentOrders, highOrders...)
	redactPriceList(c.MustGet(middleware.RoleKey), orders)
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

// Detail returns a single order (with items, creator, and assignee) owned by
// the authenticated user.
func (h *OrderHandler) Detail(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	role, _ := c.Get(middleware.RoleKey)
	id := c.Param("id")

	query := h.DB.Preload("Items").Preload("CreatedBy")
	if role == string(models.RoleSales) {
		query = query.Where("created_by_id = ?", userID)
	}

	var order models.Order
	err := query.First(&order, id).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load order"})
		return
	}

	redactPriceListOne(role, &order)
	c.JSON(http.StatusOK, gin.H{"order": order})
}

type orderSummary struct {
	TotalValue float64 `json:"totalValue"`
	Currency   string  `json:"currency"`
	Total      int64   `json:"total"`
	Active     int64   `json:"active"`
	Pending    int64   `json:"pending"`
	Urgent     int64   `json:"urgent"`
}

// Summary returns aggregate stats for the authenticated user's orders.
func (h *OrderHandler) Summary(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	scoped := func() *gorm.DB {
		return h.DB.Model(&models.Order{}).Where("created_by_id = ?", userID)
	}

	summary := orderSummary{Currency: "₹"}

	if err := scoped().Count(&summary.Total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load summary"})
		return
	}
	if err := scoped().Where("status IN ?", []models.OrderStatus{models.OrderStatusInProgress, models.OrderStatusDispatched}).Count(&summary.Active).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load summary"})
		return
	}
	if err := scoped().Where("status = ?", models.OrderStatusPending).Count(&summary.Pending).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load summary"})
		return
	}
	if err := scoped().Where("urgency = ?", models.OrderUrgencyUrgent).Count(&summary.Urgent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load summary"})
		return
	}
	if err := scoped().Select("COALESCE(SUM(value), 0)").Row().Scan(&summary.TotalValue); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load summary"})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// managerDashboardRegions is a fixed list of the regions the business
// operates in, always shown on the manager dashboard (even at zero orders)
// rather than derived from whatever cities happen to appear in the data —
// matches the "Northern Emirates: 0 orders" row product wants visible from
// day one, before any order has actually shipped there.
var managerDashboardRegions = []string{"Dubai", "Abu Dhabi", "Sharjah", "Northern Emirates"}

type regionRevenue struct {
	Region  string  `json:"region"`
	Orders  int64   `json:"orders"`
	Revenue float64 `json:"revenue"`
}

type managerDashboard struct {
	Currency        string          `json:"currency"`
	TotalValue      float64         `json:"totalValue"`
	TotalOrders     int64           `json:"totalOrders"`
	RegionCount     int             `json:"regionCount"`
	InProgress      int64           `json:"inProgress"`
	Delayed         int64           `json:"delayed"`
	DispatchReady   int64           `json:"dispatchReady"`
	Completed       int64           `json:"completed"`
	Rejected        int64           `json:"rejected"`
	RevenueByRegion []regionRevenue `json:"revenueByRegion"`
	WeeklyOrders    [7]int64        `json:"weeklyOrders"` // Mon..Sun, current calendar week
}

// ManagerDashboard returns company-wide aggregate stats across every sales
// rep's orders (manager-only route — see managerOnly in router.go). Unlike
// Summary (which scopes to the requesting sales rep), nothing here is
// filtered by created_by_id.
func (h *OrderHandler) ManagerDashboard(c *gin.Context) {
	scoped := func() *gorm.DB { return h.DB.Model(&models.Order{}) }

	dashboard := managerDashboard{Currency: "₹", RegionCount: len(managerDashboardRegions)}

	if err := scoped().Count(&dashboard.TotalOrders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	if err := scoped().Select("COALESCE(SUM(value), 0)").Row().Scan(&dashboard.TotalValue); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	if err := scoped().Where("status = ?", models.OrderStatusInProgress).Count(&dashboard.InProgress).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	if err := scoped().
		Where("status IN ? AND due_date < ?", []models.OrderStatus{models.OrderStatusApproved, models.OrderStatusInProgress, models.OrderStatusDispatched}, time.Now()).
		Count(&dashboard.Delayed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	if err := scoped().Where("status = ?", models.OrderStatusDispatched).Count(&dashboard.DispatchReady).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	if err := scoped().Where("status = ?", models.OrderStatusDelivered).Count(&dashboard.Completed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	if err := scoped().Where("status = ?", models.OrderStatusRejected).Count(&dashboard.Rejected).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}

	dashboard.RevenueByRegion = make([]regionRevenue, len(managerDashboardRegions))
	for i, region := range managerDashboardRegions {
		rr := regionRevenue{Region: region}
		row := scoped().Where("LOWER(city) = LOWER(?)", region)
		if err := row.Count(&rr.Orders).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
			return
		}
		if err := scoped().Where("LOWER(city) = LOWER(?)", region).Select("COALESCE(SUM(value), 0)").Row().Scan(&rr.Revenue); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
			return
		}
		dashboard.RevenueByRegion[i] = rr
	}

	type weeklyRow struct {
		Dow   int
		Count int64
	}
	var weeklyRows []weeklyRow
	if err := h.DB.Raw(`
		SELECT EXTRACT(ISODOW FROM created_at)::int AS dow, COUNT(*) AS count
		FROM orders
		WHERE created_at >= date_trunc('week', now()) AND created_at < date_trunc('week', now()) + interval '7 days'
		GROUP BY dow
	`).Scan(&weeklyRows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}
	for _, row := range weeklyRows {
		if row.Dow >= 1 && row.Dow <= 7 {
			dashboard.WeeklyOrders[row.Dow-1] = row.Count
		}
	}

	c.JSON(http.StatusOK, dashboard)
}

type orderItemRequest struct {
	ProductName string `json:"productName" binding:"required"`
	Description string `json:"description"`
	Quantity    int    `json:"quantity" binding:"required,min=1"`
	Unit        string `json:"unit" binding:"required"`
}

type createOrderRequest struct {
	ClientName    string             `json:"clientName" binding:"required"`
	City          string             `json:"city" binding:"required"`
	Address       string             `json:"address"`
	Latitude      *float64           `json:"latitude"`
	Longitude     *float64           `json:"longitude"`
	PriceListName string             `json:"priceListName" binding:"required"`
	Urgency       string             `json:"urgency" binding:"required,oneof=low medium high urgent"`
	Currency      string             `json:"currency"`
	DueDate       string             `json:"dueDate" binding:"required"`
	Items         []orderItemRequest `json:"items" binding:"required,min=1,dive"`
}

// findOrCreateCustomer looks up a Customer by case-insensitive exact name
// match, creating one if none exists. Customers are a shared, company-wide
// directory rather than scoped per user.
func findOrCreateCustomer(db *gorm.DB, name string, userID uint) (models.Customer, error) {
	var customer models.Customer
	err := db.Where("LOWER(name) = LOWER(?)", name).First(&customer).Error
	if err == nil {
		return customer, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return customer, err
	}
	customer = models.Customer{Name: name, CreatedByID: userID}
	if err := db.Create(&customer).Error; err != nil {
		return customer, err
	}
	return customer, nil
}

// findOrCreateProduct looks up a Product by case-insensitive exact name
// match, creating one if none exists.
func findOrCreateProduct(db *gorm.DB, name, unit string, userID uint) (models.Product, error) {
	var product models.Product
	err := db.Where("LOWER(name) = LOWER(?)", name).First(&product).Error
	if err == nil {
		return product, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return product, err
	}
	product = models.Product{Name: name, Unit: unit, CreatedByID: userID}
	if err := db.Create(&product).Error; err != nil {
		return product, err
	}
	return product, nil
}

// Create creates a new order for the authenticated (sales) user. Ticket
// numbers come from a Postgres sequence so they stay unique under concurrent
// creates without a two-phase insert-then-update.
func (h *OrderHandler) Create(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	role := c.MustGet(middleware.RoleKey)

	var req createOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dueDate, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dueDate must be in YYYY-MM-DD format"})
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "₹"
	}

	var ticketSeq int64
	if err := h.DB.Raw("SELECT nextval('order_ticket_seq')").Scan(&ticketSeq).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate ticket number"})
		return
	}

	customer, err := findOrCreateCustomer(h.DB, req.ClientName, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve customer"})
		return
	}

	// Pricing always comes from the requesting user's assigned price list,
	// never from client input — sales reps can't set or edit prices.
	priceByProductID := priceListLookup(h.DB, userID)

	items := make([]models.OrderItem, len(req.Items))
	var value float64
	for i, item := range req.Items {
		product, err := findOrCreateProduct(h.DB, item.ProductName, item.Unit, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve product"})
			return
		}
		unitPrice := priceByProductID[product.ID]
		items[i] = models.OrderItem{
			ProductID:   &product.ID,
			ProductName: product.Name,
			Description: item.Description,
			Quantity:    item.Quantity,
			Unit:        item.Unit,
			UnitPrice:   unitPrice,
		}
		value += float64(item.Quantity) * unitPrice
	}

	order := models.Order{
		TicketNumber:  fmt.Sprintf("TKT-%d", ticketSeq),
		CustomerID:    &customer.ID,
		ClientName:    customer.Name,
		City:          req.City,
		Address:       req.Address,
		Latitude:      req.Latitude,
		Longitude:     req.Longitude,
		PriceListName: req.PriceListName,
		Status:        models.OrderStatusPending,
		Urgency:       models.OrderUrgency(req.Urgency),
		Value:         value,
		Currency:      currency,
		DueDate:       dueDate,
		CreatedByID:   userID,
		Items:         items,
	}

	if err := h.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create order"})
		return
	}

	if err := h.DB.Preload("CreatedBy").First(&order, order.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load created order"})
		return
	}

	redactPriceListOne(role, &order)
	c.JSON(http.StatusCreated, gin.H{"order": order})
}

type updateOrderStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=pending approved rejected in_progress dispatched delivered cancelled"`
	Reason string `json:"reason"`
}

// UpdateStatus moves an order to a new status (manufacturing/manager only —
// sales creates orders but doesn't fulfill them). Only transitions defined
// in models.orderStatusTransitions are allowed, so the API can't be used to
// skip steps or resurrect a terminal order. Notifying the order's creator
// happens in the same transaction as the status change itself, so the
// alert is created at the moment the event happens rather than synthesized
// later when someone happens to open the Alerts screen.
func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	role := c.MustGet(middleware.RoleKey)

	var req updateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newStatus := models.OrderStatus(req.Status)
	reason := strings.TrimSpace(req.Reason)
	if newStatus == models.OrderStatusRejected && reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required to reject an order"})
		return
	}

	var order models.Order
	if err := h.DB.First(&order, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load order"})
		return
	}

	previousStatus := order.Status
	if !previousStatus.CanTransitionTo(newStatus) {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("cannot move an order from %s to %s", previousStatus, newStatus)})
		return
	}

	order.RejectionReason = reason
	notification := notify.StatusChangeNotification(order, previousStatus, newStatus)

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{"status": newStatus}
		if newStatus == models.OrderStatusRejected {
			updates["rejection_reason"] = reason
		}
		if err := tx.Model(&order).Updates(updates).Error; err != nil {
			return err
		}
		if notification != nil {
			return tx.Create(notification).Error
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update order status"})
		return
	}

	// Pushed after the transaction commits — the goroutine outlives this
	// request, so it must use the long-lived h.DB, not the closed tx.
	if notification != nil {
		notify.SendPush(h.DB, *notification)
	}

	order.Status = newStatus
	redactPriceListOne(role, &order)
	c.JSON(http.StatusOK, gin.H{"order": order})
}
