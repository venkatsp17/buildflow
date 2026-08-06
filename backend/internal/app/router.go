package app

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/handlers"
	"tracker-backend/internal/middleware"
)

// NewRouter builds the Gin engine shared by both the local HTTP server
// (cmd/local) and the Lambda entrypoint (cmd/lambda).
func NewRouter(db *gorm.DB, jwtSecret string, corsAllowedOrigins []string) *gin.Engine {
	router := gin.Default()
	router.Use(newCORSMiddleware(corsAllowedOrigins))

	health := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(db, jwtSecret)

	router.GET("/health", health.Health)

	authGroup := router.Group("/auth")
	authGroup.POST("/signup", authHandler.Signup)
	authGroup.POST("/login", authHandler.Login)
	authGroup.GET("/me", middleware.RequireAuth(jwtSecret), authHandler.Me)

	return router
}

// newCORSMiddleware allows the Expo app (web, served from its own origin in
// dev and prod) to call the API. "*" allows any origin — fine here since auth
// uses a Bearer token header, not cookies, so AllowCredentials stays false.
func newCORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	config := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}

	if len(allowedOrigins) == 1 && allowedOrigins[0] == "*" {
		config.AllowAllOrigins = true
	} else {
		config.AllowOrigins = allowedOrigins
	}

	return cors.New(config)
}
