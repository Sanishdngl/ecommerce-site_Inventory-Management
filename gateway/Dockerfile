FROM node:20-alpine AS builder
WORKDIR /app

COPY tsconfig.json .
COPY shared/ ./shared/

COPY gateway/package*.json ./gateway/
RUN cd gateway && npm ci

COPY gateway/ ./gateway/

RUN cd gateway && npx tsc --noEmit

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/tsconfig.json .
COPY --from=builder /app/shared/       ./shared/
COPY --from=builder /app/gateway/      ./gateway/

WORKDIR /app/gateway

CMD ["npm", "run", "start"]