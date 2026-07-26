FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/admin-service/package.json ./services/admin-service/
COPY services/customer-service/package.json ./services/customer-service/
COPY services/inventory-service/package.json ./services/inventory-service/
COPY services/search-indexer-service/package.json ./services/search-indexer-service/
COPY services/cache-invalidation-service/package.json ./services/cache-invalidation-service/

RUN npm ci

COPY tsconfig.json .
COPY shared/ ./shared/
COPY infrastructure/ ./infrastructure/
COPY services/cache-invalidation-service/ ./services/cache-invalidation-service/

WORKDIR /app/services/cache-invalidation-service
CMD ["npm", "run", "start"]
