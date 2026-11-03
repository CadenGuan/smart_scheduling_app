FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install dependencies across workspaces
RUN npm ci

# Copy sources for shared and server
COPY shared/ shared/
COPY server/ server/

# Build shared and server
RUN npm run build --workspace=shared && npm run build --workspace=server

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/app.db

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Copy built artifacts and node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
