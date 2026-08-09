package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

type ProductHandler struct {
	DB *gorm.DB
}

func NewProductHandler(db *gorm.DB) *ProductHandler {
	return &ProductHandler{DB: db}
}

// ProductWithPrice is a Product plus the requesting user's preloaded unit
// price, if they have a price list assigned and it covers this product.
type ProductWithPrice struct {
	models.Product
	UnitPrice *float64 `json:"unitPrice,omitempty"`
}

// List returns products, optionally filtered by a ?search= substring match
// on name. Shared across all users — products are a company-wide catalog —
// but each result carries the requesting user's own price-list price, if any.
//
// Plain calls (autocomplete pickers in order/price-list creation) get only
// active products, capped to a short list. ?includeInactive=true is a
// separate signal meaning "this is the product-management screen, not an
// autocomplete" — it always lifts the cap, and additionally lifts the
// active-only filter, but only for a super user; everyone else still gets
// the full *active* catalog (just uncapped), never the disabled entries.
func (h *ProductHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	query := h.DB.Model(&models.Product{}).Order("name asc")
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	isSuperUser, _ := c.Get(middleware.IsSuperUserKey)
	superUser, _ := isSuperUser.(bool)
	isManagementView := c.Query("includeInactive") == "true"

	if !isManagementView {
		query = query.Where("active = ?", true).Limit(10)
	} else if !superUser {
		query = query.Where("active = ?", true)
	}

	var products []models.Product
	if err := query.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load products"})
		return
	}

	priceByProductID := priceListLookup(h.DB, userID)

	results := make([]ProductWithPrice, len(products))
	for i, product := range products {
		result := ProductWithPrice{Product: product}
		if price, ok := priceByProductID[product.ID]; ok {
			priceCopy := price
			result.UnitPrice = &priceCopy
		}
		results[i] = result
	}

	c.JSON(http.StatusOK, gin.H{"products": results})
}

type createProductRequest struct {
	Name        string `json:"name" binding:"required"`
	Unit        string `json:"unit" binding:"required"`
	Description string `json:"description"`
}

// Create adds a new product to the shared catalog. Super-user only (see
// RequireSuperUser in router.go) — order creation and price lists can only
// reference a product that's already in this catalog, never invent one on
// the fly, so this is the single place new products come from.
func (h *ProductHandler) Create(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var req createProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.Product
	err := h.DB.Where("LOWER(name) = LOWER(?)", req.Name).First(&existing).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a product with this name already exists"})
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing products"})
		return
	}

	product := models.Product{Name: req.Name, Unit: req.Unit, Description: req.Description, CreatedByID: userID, Active: true}
	if err := h.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create product"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"product": product})
}

type setProductActiveRequest struct {
	Active bool `json:"active"`
}

// SetActive enables or disables a product. A disabled product drops out of
// List's default (active-only) results, so it can no longer be selected for
// a new order or price-list item — existing orders/items that already
// reference it are untouched. Super-user only.
func (h *ProductHandler) SetActive(c *gin.Context) {
	targetID := c.Param("id")

	var req setProductActiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var product models.Product
	if err := h.DB.First(&product, targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	if err := h.DB.Model(&product).Update("active", req.Active).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update product"})
		return
	}
	product.Active = req.Active

	c.JSON(http.StatusOK, gin.H{"product": product})
}
