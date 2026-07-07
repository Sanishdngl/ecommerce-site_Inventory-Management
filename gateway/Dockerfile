FROM node:20-alpine AS builder
WORKDIR /app

# See services/inventory-service/Dockerfile for why node_modules has to land
# at /app rather than gateway/node_modules.
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/
COPY services/admin-service/package.json ./services/admin-service/
COPY services/customer-service/package.json ./services/customer-service/
COPY services/inventory-service/package.json ./services/inventory-service/

RUN npm ci

COPY tsconfig.json .
COPY shared/ ./shared/
COPY infrastructure/ ./infrastructure/
COPY gateway/ ./gateway/

RUN cd gateway && npx tsc --noEmit

FROM node:20-alpine
WORKDIR /app

# node_modules copied to /app, not /app/gateway — same resolution
# requirement as the builder stage above.
COPY --from=builder /app/node_modules      ./node_modules
COPY --from=builder /app/tsconfig.json     .
COPY --from=builder /app/shared/           ./shared/
COPY --from=builder /app/infrastructure/   ./infrastructure/
COPY --from=builder /app/gateway/          ./gateway/

WORKDIR /app/gateway
CMD ["npm", "run", "start"]
