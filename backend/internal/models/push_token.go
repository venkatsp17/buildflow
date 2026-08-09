package models

import "time"

// PushToken is a device's Expo push token, registered by the frontend after
// the user grants notification permission. A user can have several (one per
// device); a token is unique so re-registering on a different account (e.g.
// a shared device) reassigns it rather than duplicating it.
type PushToken struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"userId"`
	Token     string    `gorm:"not null;uniqueIndex" json:"token"`
	CreatedAt time.Time `json:"createdAt"`
}
