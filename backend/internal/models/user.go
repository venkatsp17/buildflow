package models

import "time"

type User struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	Name              string     `gorm:"not null" json:"name"`
	Username          string     `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash      string     `gorm:"not null" json:"-"`
	Role              Role       `gorm:"not null" json:"role"`
	Active            bool       `gorm:"not null;default:true" json:"active"`
	MustResetPassword bool       `gorm:"not null;default:false" json:"mustResetPassword"`
	// IsSuperUser is only meaningful for managers — it gates account
	// disable/enable, a narrower permission than the manager role itself
	// (every manager can create accounts; only a super user can disable
	// one). Never set from user input — see the bootstrap in database.go.
	IsSuperUser bool `gorm:"not null;default:false" json:"isSuperUser"`
	PriceListID       *uint      `json:"priceListId,omitempty"`
	PriceList         *PriceList `json:"priceList,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}
