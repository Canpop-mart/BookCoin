# syntax=docker/dockerfile:1

# ---- build the web UI ----
FROM node:24-alpine AS web
WORKDIR /build/app
COPY app/package.json ./
RUN npm install
COPY app/ ./
RUN npm run build

# ---- install server deps ----
FROM node:24-alpine AS deps
WORKDIR /build/server
COPY server/package.json ./
RUN npm install --omit=dev

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    BOOKCOIN_STATIC=/app/public \
    BOOKCOIN_DB=/app/data/bookcoin.db
COPY server/ ./
COPY --from=deps /build/server/node_modules ./node_modules
COPY --from=web /build/app/dist ./public
VOLUME /app/data
EXPOSE 8787
CMD ["node", "--no-warnings", "src/index.js"]
