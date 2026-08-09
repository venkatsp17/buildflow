package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

type PushTokenHandler struct {
	DB *gorm.DB
}

func NewPushTokenHandler(db *gorm.DB) *PushTokenHandler {
	return &PushTokenHandler{DB: db}
}

type pushTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// Register upserts a device's Expo push token for the authenticated user.
// The token is globally unique — re-registering the same device under a
// different account (e.g. shared device, different login) reassigns it
// rather than creating a duplicate row.
func (h *PushTokenHandler) Register(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var req pushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pushToken := models.PushToken{UserID: userID, Token: req.Token}
	err := h.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "token"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id"}),
	}).Create(&pushToken).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register push token"})
		return
	}

	c.Status(http.StatusNoContent)
}

// Unregister removes a device's push token (e.g. on logout) so it stops
// receiving notifications for this account.
func (h *PushTokenHandler) Unregister(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uint)

	var req pushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.Where("token = ? AND user_id = ?", req.Token, userID).Delete(&models.PushToken{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unregister push token"})
		return
	}

	c.Status(http.StatusNoContent)
}
