FROM node:20-alpine
WORKDIR /app

COPY tsconfig.json .
COPY shared/ ./shared/

COPY services/inventory-service/package*.json ./services/inventory-service/
RUN cd services/inventory-service && npm ci

COPY services/inventory-service/ ./services/inventory-service/

WORKDIR /app/services/inventory-service
CMD ["npm", "run", "start"]