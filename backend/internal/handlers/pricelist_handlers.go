package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

type PriceListHandler struct {
	DB *gorm.DB
}

func NewPriceListHandler(db *gorm.DB) *PriceListHandler {
	return &PriceListHandler{DB: db}
}

// List returns all price lists (manager-only).
func (h *PriceListHandler) List(c *gin.Context) {
	var priceLists []models.PriceList
	if err := h.DB.Preload("Items").Order("name asc").Find(&priceLists).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load price lists"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"priceLists": priceLists})
}

// Detail returns one price list with its items and the users it's assigned to.
func (h *PriceListHandler) Detail(c *gin.Context) {
	id := c.Param("id")

	var priceList models.PriceList
	if err := h.DB.Preload("Items.Product").First(&priceList, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "price list not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load price list"})
		return
	}

	var assignedUsers []models.User
	if err := h.DB.Where("price_list_id = ?", priceList.ID).Find(&assignedUsers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load assigned users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"priceList": priceList, "assignedUsers": assignedUsers})
}

type priceListItemRequest struct {
	ProductID uint    `json:"productId" binding:"required"`
	UnitPrice float64 `json:"unitPrice" binding:"required,gte=0"`
}

type createPriceListRequest struct {
	Name  string                 `json:"name" binding:"required"`
	Items []priceListItemRequest `json:"items" binding:"required,min=1,dive"`
}

// Create creates a new price list with its per-product prices.
func (h *PriceListHandler) Create(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var req createPriceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priceList := models.PriceList{Name: req.Name, CreatedByID: userID}
	if err := h.DB.Create(&priceList).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create price list"})
		return
	}

	items := make([]models.PriceListItem, len(req.Items))
	for i, item := range req.Items {
		items[i] = models.PriceListItem{PriceListID: priceList.ID, ProductID: item.ProductID, UnitPrice: item.UnitPrice}
	}
	if err := h.DB.Create(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create price list items"})
		return
	}

	if err := h.DB.Preload("Items.Product").First(&priceList, priceList.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load created price list"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"priceList": priceList})
}

// Update replaces a price list's name and its full set of items.
func (h *PriceListHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var priceList models.PriceList
	if err := h.DB.First(&priceList, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "price list not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load price list"})
		return
	}

	var req createPriceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&priceList).Update("name", req.Name).Error; err != nil {
			return err
		}
		if err := tx.Where("price_list_id = ?", priceList.ID).Delete(&models.PriceListItem{}).Error; err != nil {
			return err
		}
		items := make([]models.PriceListItem, len(req.Items))
		for i, item := range req.Items {
			items[i] = models.PriceListItem{PriceListID: priceList.ID, ProductID: item.ProductID, UnitPrice: item.UnitPrice}
		}
		return tx.Create(&items).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update price list"})
		return
	}

	if err := h.DB.Preload("Items.Product").First(&priceList, priceList.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load updated price list"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"priceList": priceList})
}
