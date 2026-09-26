package models

import "time"

type Customer struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Phone       string    `json:"phone"`
	Email       string    `json:"email"`
	GSTNo       string    `gorm:"column:gst_no" json:"gstNo"`
	Address     string    `json:"address"`
	City        string    `json:"city"`
	Latitude    *float64  `json:"latitude,omitempty"`
	Longitude   *float64  `json:"longitude,omitempty"`
	CreatedByID uint      `gorm:"not null;index" json:"createdById"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
