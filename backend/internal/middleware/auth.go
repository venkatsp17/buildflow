package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/auth"
	"tracker-backend/internal/models"
)

const (
	UserIDKey = "userID"
	RoleKey   = "role"
)

// RequireAuth validates the Authorization: Bearer <token> header and stores
// the authenticated user ID in the request context, or aborts with 401. It
// also checks the user is still active on every request (not just at login)
// so a manager disabling an account takes effect immediately, rather than
// leaving already-issued tokens valid until they naturally expire.
func RequireAuth(db *gorm.DB, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
			return
		}

		claims, err := auth.ParseToken(parts[1], jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		var user models.User
		if err := db.Select("active", "must_reset_password").First(&user, claims.UserID).Error; err != nil || !user.Active {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "account disabled"})
			return
		}

		// Enforced here (not just in the frontend's routing) so a forced
		// password reset actually blocks the API, not just the UI. /auth/me
		// and /auth/reset-password stay reachable — the app needs the first
		// to know who's logged in and the second to actually clear the flag.
		if user.MustResetPassword && c.FullPath() != "/auth/me" && c.FullPath() != "/auth/reset-password" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "password reset required", "code": "password_reset_required"})
			return
		}

		c.Set(UserIDKey, claims.UserID)
		c.Set(RoleKey, claims.Role)
		c.Next()
	}
}

// RequireRole must run after RequireAuth. It aborts with 403 unless the
// authenticated user's role is one of the given roles.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}

	return func(c *gin.Context) {
		role, _ := c.Get(RoleKey)
		roleStr, _ := role.(string)

		if !allowed[roleStr] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}

		c.Next()
	}
}
