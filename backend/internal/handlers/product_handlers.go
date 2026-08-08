package handlers

import (
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
func (h *ProductHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	query := h.DB.Model(&models.Product{}).Order("name asc").Limit(10)
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	var products []models.Product
	if err := query.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load products"})
		return
	}

	priceByProductID := map[uint]float64{}
	var user models.User
	if err := h.DB.First(&user, userID).Error; err == nil && user.PriceListID != nil {
		var items []models.PriceListItem
		if err := h.DB.Where("price_list_id = ?", *user.PriceListID).Find(&items).Error; err == nil {
			for _, item := range items {
				priceByProductID[item.ProductID] = item.UnitPrice
			}
		}
	}

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
