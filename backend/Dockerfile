# ------------------------------------------------------------------------------
# CardSplit - BACKEND service (Node.js + Express REST API)
# ------------------------------------------------------------------------------
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Install dependencies first -> Docker caches this layer until package.json changes
# (package-lock.json is optional; if you add one it will be used for reproducible installs)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# 2) Copy the application code
COPY src ./src

# Run as the unprivileged "node" user that ships with the image (safer than root)
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
