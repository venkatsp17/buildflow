// Package notify creates in-app Notification rows and delivers them as real
// device push notifications via Expo's push service. It's shared by the
// order status-update handler (event-driven: fires the instant a status
// changes) and the background delayed-order sweep (time-driven: there's no
// discrete "became overdue" event, so a periodic scan is what stands in for
// one).
package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"gorm.io/gorm"

	"tracker-backend/internal/models"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

// CreateAndPush inserts a Notification and, best-effort, delivers it as a
// push to every device registered for that user. Push delivery never blocks
// or fails the caller — it runs in the background and errors are swallowed,
// since the in-app Notification row is the source of truth and the Alerts
// screen always reflects it regardless of whether the push arrives.
func CreateAndPush(db *gorm.DB, notification models.Notification) error {
	if err := db.Create(&notification).Error; err != nil {
		return err
	}
	SendPush(db, notification)
	return nil
}

// SendPush delivers a notification that's already been persisted as a push,
// in the background. Callers that need to insert the row inside their own
// transaction should call this afterwards with a non-transactional *gorm.DB
// (the goroutine can outlive the transaction, so it must not use tx).
func SendPush(db *gorm.DB, notification models.Notification) {
	go deliverPush(db, notification)
}

// StatusChangeNotification returns the notification to create for an order
// moving from one status to another, or nil if that transition doesn't
// notify the creator (e.g. cancelled, or approved -> in_progress which the
// creator doesn't need a separate alert for).
func StatusChangeNotification(order models.Order, from, to models.OrderStatus) *models.Notification {
	if from == to {
		return nil
	}

	var notifType models.NotificationType
	var title, message string
	switch to {
	case models.OrderStatusApproved:
		notifType = models.NotificationTypeOrderApproved
		title = "Order Approved"
		message = fmt.Sprintf("%s approved by manufacturing", order.TicketNumber)
	case models.OrderStatusRejected:
		notifType = models.NotificationTypeOrderRejected
		title = "Order Rejected"
		message = fmt.Sprintf("%s rejected — %s", order.TicketNumber, order.RejectionReason)
	case models.OrderStatusDispatched:
		notifType = models.NotificationTypeDispatchReady
		title = "Dispatch Ready"
		message = fmt.Sprintf("%s ready for dispatch", order.TicketNumber)
	default:
		return nil
	}

	return &models.Notification{
		UserID:  order.CreatedByID,
		OrderID: order.ID,
		Type:    notifType,
		Title:   title,
		Message: message,
	}
}

// SweepDelayedOrders scans every overdue order still somewhere in the
// approved fulfillment pipeline (approved, in_progress, dispatched —
// "delayed" is a sub-state of Approved, not something pending or already
// terminal orders can be) and creates (+ pushes) a "delayed" notification
// for any that don't already have one — dismissing one is permanent (see
// Notification.Dismissed) so this never resurrects a cleared alert.
func SweepDelayedOrders(db *gorm.DB) error {
	var overdueOrders []models.Order
	err := db.
		Where("status IN ? AND due_date < ?",
			[]models.OrderStatus{models.OrderStatusApproved, models.OrderStatusInProgress, models.OrderStatusDispatched}, time.Now()).
		Where("NOT EXISTS (SELECT 1 FROM notifications n WHERE n.order_id = orders.id AND n.type = ?)", models.NotificationTypeOrderDelayed).
		Find(&overdueOrders).Error
	if err != nil {
		return err
	}

	for _, order := range overdueOrders {
		notification := models.Notification{
			UserID:  order.CreatedByID,
			OrderID: order.ID,
			Type:    models.NotificationTypeOrderDelayed,
			Title:   "Order Delayed",
			Message: fmt.Sprintf("%s — %s delayed. Review needed.", order.TicketNumber, order.ClientName),
		}
		if err := CreateAndPush(db, notification); err != nil {
			return err
		}
	}
	return nil
}

// StartDelayedOrderScheduler runs SweepDelayedOrders immediately and then on
// a fixed interval for the lifetime of the process. This is what makes
// "delayed" detection push-driven rather than something the frontend has to
// poll for.
//
// This is intended for the long-running local dev server. A production
// Lambda deployment can't rely on a goroutine ticker surviving Lambda's
// freeze/thaw cycle between invocations — that setup needs a small scheduled
// Lambda invoking SweepDelayedOrders directly, wired to an EventBridge rule.
func StartDelayedOrderScheduler(db *gorm.DB, interval time.Duration) {
	sweep := func() {
		if err := SweepDelayedOrders(db); err != nil {
			log.Printf("delayed order sweep failed: %v", err)
		}
	}
	sweep()
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			sweep()
		}
	}()
}

type expoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title"`
	Body  string         `json:"body"`
	Data  map[string]any `json:"data,omitempty"`
}

func deliverPush(db *gorm.DB, notification models.Notification) {
	var tokens []models.PushToken
	if err := db.Where("user_id = ?", notification.UserID).Find(&tokens).Error; err != nil || len(tokens) == 0 {
		return
	}

	messages := make([]expoPushMessage, len(tokens))
	for i, t := range tokens {
		messages[i] = expoPushMessage{
			To:    t.Token,
			Title: notification.Title,
			Body:  notification.Message,
			Data:  map[string]any{"orderId": notification.OrderID, "notificationId": notification.ID},
		}
	}

	body, err := json.Marshal(messages)
	if err != nil {
		return
	}

	req, err := http.NewRequest(http.MethodPost, expoPushURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}
