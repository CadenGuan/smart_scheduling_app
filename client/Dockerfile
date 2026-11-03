FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install dependencies across workspaces
RUN npm ci

# Copy shared and client sources
COPY shared/ shared/
COPY client/ client/

# Build shared library and Vite production bundle
RUN npm run build --workspace=shared && npm run build --workspace=client

# Production image with Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
