package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/auth"
	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

type UserHandler struct {
	DB *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{DB: db}
}

// List returns users, optionally filtered by ?role=. Manager-only — used to
// see the sales team when assigning price lists.
func (h *UserHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.User{}).Order("email asc")
	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", role)
	}

	var users []models.User
	if err := query.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

type createUserRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required,oneof=sales manufacturing manager"`
}

// CreateUser provisions a new account. Manager-only — there's no public
// signup, so this is the only way an account gets created after the initial
// seed data.
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
		return
	}

	user := models.User{Email: req.Email, PasswordHash: passwordHash, Role: models.Role(req.Role), Active: true}
	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}

type setUserActiveRequest struct {
	Active bool `json:"active"`
}

// SetUserActive enables or disables an account. A disabled account can't log
// in and any already-issued token for it stops working on the next request
// (see middleware.RequireAuth) rather than waiting for natural expiry.
// Manager-only, and a manager can't disable their own account — that would
// lock everyone out with no one left to undo it.
func (h *UserHandler) SetUserActive(c *gin.Context) {
	targetID := c.Param("id")
	requestingUserID := c.MustGet(middleware.UserIDKey).(uint)

	var req setUserActiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.First(&user, targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if user.ID == requestingUserID && !req.Active {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you can't disable your own account"})
		return
	}

	if err := h.DB.Model(&user).Update("active", req.Active).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}
	user.Active = req.Active

	c.JSON(http.StatusOK, gin.H{"user": user})
}

type assignPriceListRequest struct {
	PriceListID *uint `json:"priceListId"`
}

// AssignPriceList sets (or clears, if null) the price list assigned to a
// user. Manager-only.
func (h *UserHandler) AssignPriceList(c *gin.Context) {
	targetID := c.Param("id")

	var req assignPriceListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.First(&user, targetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := h.DB.Model(&user).Update("price_list_id", req.PriceListID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign price list"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
