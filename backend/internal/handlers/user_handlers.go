package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/models"
)

type UserHandler struct {
	DB *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{DB: db}
}

// List returns users, optionally filtered by ?role=. Manager-only — used to
// see the sales team when assigning price lists.
func (h *UserHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.User{}).Order("email asc")
	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", role)
	}

	var users []models.User
	if err := query.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

type assignPriceListRequest struct {
	PriceListID *uint `json:"priceListId"`
}

// AssignPriceList sets (or clears, if null) the price list assigned to a
// user. Manager-only.
func (h *UserHandler) AssignPriceList(c *gin.Context) {
	targetID := c.Param("id")

	var req assignPriceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.First(&user, targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := h.DB.Model(&user).Update("price_list_id", req.PriceListID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign price list"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
