package handlers

import (
	"gorm.io/gorm"

	"tracker-backend/internal/models"
)

// priceListLookup returns a productID -> unitPrice map from the given user's
// assigned price list (empty if they have none). Used so pricing always
// comes from the manager-controlled price list, never from client input.
func priceListLookup(db *gorm.DB, userID uint) map[uint]float64 {
	prices := map[uint]float64{}

	var user models.User
	if err := db.First(&user, userID).Error; err != nil || user.PriceListID == nil {
		return prices
	}

	var items []models.PriceListItem
	if err := db.Where("price_list_id = ?", *user.PriceListID).Find(&items).Error; err != nil {
		return prices
	}

	for _, item := range items {
		prices[item.ProductID] = item.UnitPrice
	}
	return prices
}
