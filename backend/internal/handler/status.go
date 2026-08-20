package handler

import (
	"net"
	"net/http"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/serverpilot/backend/internal/config"
)

// startTime is set once when the package loads — used for uptime calculation.
var startTime = time.Now()

type serviceResult struct {
	Status    string `json:"status"`
	LatencyMs int64  `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

// Status checks every downstream service via TCP dial (no DB driver needed)
// and returns a JSON summary of the whole system.
func Status(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pgAddr    := postgresAddr(cfg.DatabaseURL)
		redisAddr := redisAddr(cfg.RedisURL)

		// Check all services concurrently
		type named struct {
			name string
			addr string
		}
		targets := []named{
			{"postgres", pgAddr},
			{"redis", redisAddr},
		}

		results := make(map[string]serviceResult, len(targets))
		var mu sync.Mutex
		var wg sync.WaitGroup

		for _, t := range targets {
			wg.Add(1)
			go func(name, addr string) {
				defer wg.Done()
				r := dialTCP(addr)
				mu.Lock()
				results[name] = r
				mu.Unlock()
			}(t.name, t.addr)
		}
		wg.Wait()

		// Overall status
		overall := "ok"
		for _, s := range results {
			if s.Status != "ok" {
				overall = "degraded"
				break
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"status":         overall,
			"version":        "0.1.0",
			"env":            cfg.AppEnv,
			"uptime_seconds": int64(time.Since(startTime).Seconds()),
			"goroutines":     runtime.NumGoroutine(),
			"services":       results,
			"timestamp":      time.Now().UTC(),
		})
	}
}

// dialTCP tries to open a TCP connection to addr and measures latency.
func dialTCP(addr string) serviceResult {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	ms := time.Since(start).Milliseconds()
	if err != nil {
		return serviceResult{Status: "error", LatencyMs: ms, Error: "unreachable"}
	}
	conn.Close()
	return serviceResult{Status: "ok", LatencyMs: ms}
}

// postgresAddr extracts host:port from a postgres:// URL.
// Falls back to "postgres:5432" if parsing fails.
func postgresAddr(url string) string {
	s := strings.TrimPrefix(url, "postgresql://")
	s = strings.TrimPrefix(s, "postgres://")
	if idx := strings.LastIndex(s, "@"); idx >= 0 {
		s = s[idx+1:]
	}
	if idx := strings.Index(s, "/"); idx >= 0 {
		s = s[:idx]
	}
	if idx := strings.Index(s, "?"); idx >= 0 {
		s = s[:idx]
	}
	if s == "" {
		return "postgres:5432"
	}
	return s
}

// redisAddr ensures the Redis URL has a port.
func redisAddr(url string) string {
	url = strings.TrimPrefix(url, "redis://")
	if !strings.Contains(url, ":") {
		return url + ":6379"
	}
	return url
}
