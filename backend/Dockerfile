# ── Stage 1: Install dependencies ───────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# ── Stage 2: Run ────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "require('http').get('http://localhost:8081/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
