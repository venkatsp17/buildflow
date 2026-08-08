package models

import "time"

type Product struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;not null" json:"name"`
	Unit        string    `gorm:"not null;default:units" json:"unit"`
	Description string    `json:"description"`
	CreatedByID uint      `gorm:"not null;index" json:"createdById"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
