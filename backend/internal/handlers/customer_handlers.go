package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/models"
)

type CustomerHandler struct {
	DB *gorm.DB
}

func NewCustomerHandler(db *gorm.DB) *CustomerHandler {
	return &CustomerHandler{DB: db}
}

// List returns customers, optionally filtered by a ?search= substring match
// on name. Shared across all users — customers are a company-wide directory.
func (h *CustomerHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Customer{}).Order("name asc").Limit(10)
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	var customers []models.Customer
	if err := query.Find(&customers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load customers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"customers": customers})
}
