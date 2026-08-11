# Agbota Segun — production image
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application code
COPY server ./server
COPY public ./public
COPY scripts ./scripts

# Data directory (uploads + optional embedded DB)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "server/index.js"]
