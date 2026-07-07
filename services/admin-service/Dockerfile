FROM node:20-alpine
WORKDIR /app

# See services/inventory-service/Dockerfile for why node_modules has to land
# at /app rather than services/admin-service/node_modules.
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/admin-service/package.json ./services/admin-service/
COPY services/customer-service/package.json ./services/customer-service/
COPY services/inventory-service/package.json ./services/inventory-service/

RUN npm ci

COPY tsconfig.json .
COPY shared/ ./shared/
COPY infrastructure/ ./infrastructure/
COPY services/admin-service/ ./services/admin-service/

WORKDIR /app/services/admin-service
CMD ["npm", "run", "start"]
