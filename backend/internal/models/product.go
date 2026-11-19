package models

import "time"

type Product struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Unit        string    `gorm:"not null;default:units" json:"unit"`
	Description string    `json:"description"`
	HSNCode     string    `gorm:"size:8" json:"hsnCode"`
	GSTRate     *float64  `gorm:"type:numeric(7,4);check:products_gst_rate,gst_rate >= 0 AND gst_rate <= 100" json:"gstRate"`
	TaxCategory string    `gorm:"size:20" json:"taxCategory"`
	Active      bool      `gorm:"not null;default:true" json:"active"`
	CreatedByID uint      `gorm:"not null;index" json:"createdById"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
