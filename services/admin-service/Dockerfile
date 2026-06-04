FROM node:20-alpine
WORKDIR /app

COPY tsconfig.json .
COPY shared/ ./shared/

COPY services/admin-service/package*.json ./services/admin-service/
RUN cd services/admin-service && npm ci

COPY services/admin-service/ ./services/admin-service/

WORKDIR /app/services/admin-service
CMD ["npm", "run", "start"]