# ------------------------------------------------------------------------------
# CardSplit - FRONTEND service (React + Vite, served by Nginx)
# Multi-stage build: stage 1 compiles the app, stage 2 ships only the static
# files inside a tiny Nginx image.
# ------------------------------------------------------------------------------

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

# (package-lock.json is optional; if you add one it will be used for reproducible installs)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .

# Leave empty to use the built-in Nginx proxy ("/api"). Only set this if your API is on another domain.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine

ENV BACKEND_HOST=backend \
    BACKEND_PORT=5000

# Files in /etc/nginx/templates/*.template are rendered to /etc/nginx/conf.d/ at startup
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
