package handler

import (
	"net/http"
	"time"

	"github.com/serverpilot/backend/internal/config"
)

func Health(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":    "ok",
			"service":   "serverpilot-backend",
			"version":   "0.1.0",
			"env":       cfg.AppEnv,
			"timestamp": time.Now().UTC(),
		})
	}
}
