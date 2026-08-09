package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

type NotificationHandler struct {
	DB *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{DB: db}
}

// List returns the authenticated user's notifications, newest first, plus
// an unread count for the bell badge. A pure read — notifications are
// created the instant their triggering event happens (a status change, or
// the background delayed-order sweep), not synthesized here.
func (h *NotificationHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var notifications []models.Notification
	if err := h.DB.Where("user_id = ? AND dismissed = ?", userID, false).Order("created_at desc").Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load notifications"})
		return
	}

	var unreadCount int64
	if err := h.DB.Model(&models.Notification{}).Where("user_id = ? AND dismissed = ? AND read = ?", userID, false, false).Count(&unreadCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"notifications": notifications, "unreadCount": unreadCount})
}

// MarkRead marks one of the authenticated user's notifications as read.
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	id := c.Param("id")

	result := h.DB.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read", true)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update notification"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Delete dismisses one notification. This is a soft delete (see
// Notification.Dismissed) so a still-true derived condition, like an order
// still being overdue, can't cause the delayed sweep to recreate it.
func (h *NotificationHandler) Delete(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	id := c.Param("id")

	result := h.DB.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("dismissed", true)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete notification"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ClearAll dismisses every notification for the authenticated user.
func (h *NotificationHandler) ClearAll(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)
	if err := h.DB.Model(&models.Notification{}).
		Where("user_id = ? AND dismissed = ?", userID, false).
		Update("dismissed", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear notifications"})
		return
	}
	c.Status(http.StatusNoContent)
}
