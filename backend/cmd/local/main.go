package main

import (
	"log"

	"tracker-backend/internal/app"
	"tracker-backend/internal/config"
	"tracker-backend/internal/database"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	router := app.NewRouter(db, cfg.JWTSecret, cfg.CORSAllowedOrigins)

	log.Printf("listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
