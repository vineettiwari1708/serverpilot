package config

import "os"

type Config struct {
	Port        string
	AppEnv      string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	AgentSecret string
}

func Load() Config {
	return Config{
		Port:        getEnv("PORT", "8081"),
		AppEnv:      getEnv("APP_ENV", "development"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		RedisURL:    getEnv("REDIS_URL", "redis:6379"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret"),
		AgentSecret: getEnv("AGENT_SECRET", "dev-agent-secret"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
