package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

type OrderHandler struct {
	DB *gorm.DB
}

func NewOrderHandler(db *gorm.DB) *OrderHandler {
	return &OrderHandler{DB: db}
}

// List returns the orders created by the authenticated user, most recent first.
func (h *OrderHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var orders []models.Order
	if err := h.DB.Preload("Items").
		Where("created_by_id = ?", userID).
		Order("created_at desc").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load orders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

// Detail returns a single order (with items, creator, and assignee) owned by
// the authenticated user.
func (h *OrderHandler) Detail(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	id := c.Param("id")

	var order models.Order
	err := h.DB.Preload("Items").Preload("CreatedBy").Preload("Assignee").
		Where("created_by_id = ?", userID).
		First(&order, id).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load order"})
		return
	}

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

type orderItemRequest struct {
	ProductName string  `json:"productName" binding:"required"`
	Description string  `json:"description"`
	Quantity    int     `json:"quantity" binding:"required,min=1"`
	Unit        string  `json:"unit" binding:"required"`
	UnitPrice   float64 `json:"unitPrice" binding:"gte=0"`
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

	items := make([]models.OrderItem, len(req.Items))
	var value float64
	for i, item := range req.Items {
		product, err := findOrCreateProduct(h.DB, item.ProductName, item.Unit, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve product"})
			return
		}
		items[i] = models.OrderItem{
			ProductID:   &product.ID,
			ProductName: product.Name,
			Description: item.Description,
			Quantity:    item.Quantity,
			Unit:        item.Unit,
			UnitPrice:   item.UnitPrice,
		}
		value += float64(item.Quantity) * item.UnitPrice
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

	c.JSON(http.StatusCreated, gin.H{"order": order})
}
