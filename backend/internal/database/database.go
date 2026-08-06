package database

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"tracker-backend/internal/models"
)

// Connect opens a GORM connection to Postgres and auto-migrates the schema.
func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(&models.User{}); err != nil {
		return nil, err
	}

	return db, nil
}
