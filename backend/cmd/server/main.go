package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/serverpilot/backend/internal/config"
	"github.com/serverpilot/backend/internal/handler"
)

func main() {
	cfg := config.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	logger.Info("ServerPilot backend starting",
		"version", "0.1.0",
		"port", cfg.Port,
		"env", cfg.AppEnv,
	)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      buildRouter(cfg, logger),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start in background
	go func() {
		logger.Info("listening", "addr", "http://0.0.0.0:"+cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server crashed", "error", err)
			os.Exit(1)
		}
	}()

	// Block until OS signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	logger.Info("shutting down", "signal", sig.String())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("forced shutdown", "error", err)
	}
	logger.Info("server stopped")
}

func buildRouter(cfg config.Config, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	// ── Public endpoints ────────────────────────────────────────
	// Used by Docker health checks, load balancers, dashboard widget
	mux.HandleFunc("GET /health",     handler.Health(cfg))
	mux.HandleFunc("GET /api/health", handler.Health(cfg))

	// Full infrastructure status: checks Postgres + Redis reachability
	mux.HandleFunc("GET /api/status", handler.Status(cfg))

	// Phase 1B will add:
	//   POST /api/auth/login
	//   POST /api/auth/logout
	//   GET  /api/auth/me
	//
	// Phase 2 will add:
	//   POST /api/agent/register
	//   POST /api/agent/heartbeat
	//   POST /api/agent/result

	// Catch-all 404
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":"not found","path":"` + r.URL.Path + `"}`)) //nolint:errcheck
	})

	return requestLogger(logger, mux)
}

// requestLogger wraps every handler with structured access logging.
func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, code: http.StatusOK}
		next.ServeHTTP(rw, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.code,
			"ms", time.Since(start).Milliseconds(),
		)
	})
}

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.code = code
	sw.ResponseWriter.WriteHeader(code)
}
