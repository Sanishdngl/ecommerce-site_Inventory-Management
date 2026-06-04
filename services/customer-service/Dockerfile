FROM node:20-alpine
WORKDIR /app

COPY tsconfig.json .
COPY shared/ ./shared/

COPY services/customer-service/package*.json ./services/customer-service/
RUN cd services/customer-service && npm ci

COPY services/customer-service/ ./services/customer-service/

WORKDIR /app/services/customer-service
CMD ["npm", "run", "start"]