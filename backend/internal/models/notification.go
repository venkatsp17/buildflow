package models

import "time"

type NotificationType string

const (
	NotificationTypeOrderApproved NotificationType = "order_approved"
	NotificationTypeOrderRejected NotificationType = "order_rejected"
	NotificationTypeDispatchReady NotificationType = "dispatch_ready"
	NotificationTypeOrderDelayed  NotificationType = "order_delayed"
)

// Notification is an in-app alert for the order's creator (always a sales
// user today), created the moment its triggering event happens — an order
// status change, or an order newly detected as overdue — rather than
// computed on the fly when the Alerts screen is opened.
type Notification struct {
	ID      uint             `gorm:"primaryKey" json:"id"`
	UserID  uint             `gorm:"not null;index" json:"userId"`
	OrderID uint             `gorm:"not null;index" json:"orderId"`
	Order   *Order           `json:"order,omitempty"`
	Type    NotificationType `gorm:"not null" json:"type"`
	Title   string           `gorm:"not null" json:"title"`
	Message string           `gorm:"not null" json:"message"`
	Read    bool             `gorm:"not null;default:false;index" json:"read"`
	// Dismissed is a soft-delete: dismissing hides the notification from the
	// list without deleting the row, so a still-true derived condition (like
	// "delayed") can't resurrect a notification the user already cleared.
	Dismissed bool      `gorm:"not null;default:false;index" json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}
