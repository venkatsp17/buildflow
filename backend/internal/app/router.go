package app

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"tracker-backend/internal/handlers"
	"tracker-backend/internal/middleware"
	"tracker-backend/internal/models"
)

// NewRouter builds the Gin engine shared by both the local HTTP server
// (cmd/local) and the Lambda entrypoint (cmd/lambda).
func NewRouter(db *gorm.DB, jwtSecret string, corsAllowedOrigins []string) *gin.Engine {
	router := gin.Default()
	router.Use(newCORSMiddleware(corsAllowedOrigins))

	health := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(db, jwtSecret)
	orderHandler := handlers.NewOrderHandler(db)
	customerHandler := handlers.NewCustomerHandler(db)
	productHandler := handlers.NewProductHandler(db)
	geocodeHandler := handlers.NewGeocodeHandler()
	priceListHandler := handlers.NewPriceListHandler(db)
	userHandler := handlers.NewUserHandler(db)
	notificationHandler := handlers.NewNotificationHandler(db)
	pushTokenHandler := handlers.NewPushTokenHandler(db)

	router.GET("/health", health.Health)

	authGroup := router.Group("/auth")
	authGroup.POST("/signup", authHandler.Signup)
	authGroup.POST("/login", authHandler.Login)
	authGroup.GET("/me", middleware.RequireAuth(jwtSecret), authHandler.Me)

	orderGroup := router.Group("/orders", middleware.RequireAuth(jwtSecret))
	orderGroup.GET("", orderHandler.List)
	orderGroup.GET("/summary", orderHandler.Summary)
	orderGroup.GET("/priority", orderHandler.Priority)
	orderGroup.GET("/:id", orderHandler.Detail)
	orderGroup.POST("", middleware.RequireRole(string(models.RoleSales)), orderHandler.Create)
	orderGroup.PATCH("/:id/status", middleware.RequireRole(string(models.RoleManufacturing), string(models.RoleManager)), orderHandler.UpdateStatus)

	notificationGroup := router.Group("/notifications", middleware.RequireAuth(jwtSecret))
	notificationGroup.GET("", notificationHandler.List)
	notificationGroup.PATCH("/:id/read", notificationHandler.MarkRead)
	notificationGroup.DELETE("/:id", notificationHandler.Delete)
	notificationGroup.DELETE("", notificationHandler.ClearAll)

	pushTokenGroup := router.Group("/push-tokens", middleware.RequireAuth(jwtSecret))
	pushTokenGroup.POST("", pushTokenHandler.Register)
	pushTokenGroup.DELETE("", pushTokenHandler.Unregister)

	router.GET("/customers", middleware.RequireAuth(jwtSecret), customerHandler.List)
	router.GET("/products", middleware.RequireAuth(jwtSecret), productHandler.List)
	router.GET("/geocode/search", middleware.RequireAuth(jwtSecret), geocodeHandler.Search)

	managerOnly := middleware.RequireRole(string(models.RoleManager))

	priceListGroup := router.Group("/price-lists", middleware.RequireAuth(jwtSecret), managerOnly)
	priceListGroup.GET("", priceListHandler.List)
	priceListGroup.GET("/:id", priceListHandler.Detail)
	priceListGroup.POST("", priceListHandler.Create)
	priceListGroup.PUT("/:id", priceListHandler.Update)

	router.GET("/users", middleware.RequireAuth(jwtSecret), managerOnly, userHandler.List)
	router.PATCH("/users/:id/price-list", middleware.RequireAuth(jwtSecret), managerOnly, userHandler.AssignPriceList)

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
