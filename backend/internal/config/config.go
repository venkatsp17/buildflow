package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL        string
	JWTSecret          string
	Port               string
	CORSAllowedOrigins []string
}

// Load reads configuration from the environment. In local dev, .env (if present)
// is loaded first via godotenv; in Lambda these are set as function env vars and
// godotenv.Load simply finds no file and is a no-op.
func Load() Config {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	origins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if origins == "" {
		origins = "*"
	}

	return Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		Port:               port,
		CORSAllowedOrigins: strings.Split(origins, ","),
	}
}
