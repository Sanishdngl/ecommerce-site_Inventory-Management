FROM node:20-alpine
WORKDIR /app

# Root manifest + lockfile — include all workspace package.json files
# Needed for npm ci with workspaces; node_modules at /app ensures shared/
# and infrastructure/ can resolve modules (no local package.json/node_modules).
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/admin-service/package.json ./services/admin-service/
COPY services/customer-service/package.json ./services/customer-service/
COPY services/inventory-service/package.json ./services/inventory-service/

RUN npm ci

COPY tsconfig.json .
COPY shared/ ./shared/
COPY infrastructure/ ./infrastructure/
COPY services/inventory-service/ ./services/inventory-service/

WORKDIR /app/services/inventory-service
CMD ["npm", "run", "start"]
