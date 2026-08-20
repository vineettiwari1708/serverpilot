# ── Stage 1: Build ──────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy module files first (layer cache — only re-downloads when go.mod changes)
COPY go.mod ./
RUN go mod download

# Copy source and build a static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o serverpilot ./cmd/server

# ── Stage 2: Run ────────────────────────────────────────────
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/serverpilot .

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8081/health || exit 1

CMD ["./serverpilot"]
