package models

import "time"

type PriceList struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	Name        string          `gorm:"not null" json:"name"`
	CreatedByID uint            `gorm:"not null;index" json:"createdById"`
	Items       []PriceListItem `json:"items,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

type PriceListItem struct {
	ID          uint     `gorm:"primaryKey" json:"id"`
	PriceListID uint     `gorm:"not null;index:idx_pricelist_product,unique" json:"priceListId"`
	ProductID   uint     `gorm:"not null;index:idx_pricelist_product,unique" json:"productId"`
	Product     *Product `json:"product,omitempty"`
	UnitPrice   float64  `gorm:"not null" json:"unitPrice"`
}
