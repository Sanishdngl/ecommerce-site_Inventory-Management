# E-Commerce + Inventory Management — Backend

Microservices backend for an e-commerce platform with integrated inventory management. TypeScript throughout, gRPC for inter-service calls, MySQL as system of record, Redis as a read-through cache, RustFS for object storage, and an OTel/Prometheus/Jaeger observability stack.

---

## Architecture

```
Client (React + Tailwind)
        │ HTTP/REST
        ▼
API Gateway (Express)
        │ gRPC
   ┌────┴────┐
   ▼         ▼
Admin     Customer
Service   Service
   │         │
   └────┬────┘
        │ gRPC
        ▼
  Inventory Service
        │
        ├──► MySQL (system of record)
        ├──► Redis (read-through cache)
        └──► RustFS (product images)
```

**Routing contract:**

- `Gateway → Admin Service → Inventory Service` for all admin inventory operations
- `Gateway → Customer Service → Inventory Service` for all public reads and cart enrichment
- Inventory Service is never called directly by the Gateway — this was a deliberate correction; see `admin.proto`/`customer.proto` inventory-proxying RPCs
- **Cache population is read-through, on the request path:** Inventory Service checks Redis on reads (`cacheGet`), falls through to MySQL on miss, then repopulates (`cacheSet`). Writes invalidate the relevant keys directly (`cacheDel`/`cacheDelPattern`) in the same handler that performs the MySQL write — there is no separate consumer or async propagation step.

---

## Tech Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Gateway        | Express + Node.js (TypeScript)       |
| Services       | gRPC (`@grpc/grpc-js`, TypeScript)   |
| Database       | MySQL 8.4                            |
| Cache          | Redis 7 (`ioredis`)                  |
| Object Storage | RustFS (S3-compatible)               |
| Auth           | JWT (RS256) + refresh token rotation |
| Passwords      | bcrypt                               |
| Validation     | Zod, at all HTTP entry points        |
| Tracing        | OpenTelemetry → OTLP/HTTP → Jaeger   |
| Metrics        | `prom-client` → Prometheus           |

---

## Project Structure

```
/
├── gateway/                        # Express API Gateway
│   └── src/
│       ├── controllers/            # admin, inventory, customer, public
│       ├── grpc-clients/           # admin.client.ts, customer.client.ts
│       │                          # — NO direct inventory client (by design)
│       ├── middleware/             # auth, error, upload, zod validate
│       └── routes/
│
├── services/
│   ├── admin-service/               # Admin user mgmt + RBAC + inventory delegation
│   │   └── src/{db,grpc-clients,grpc,handlers}/
│   │       # grpc-clients/ + handlers/inventory.handlers.ts: proxies
│   │       # inventory ops from Admin's own gRPC surface to Inventory Service,
│   │       # with audit logging at this delegation layer
│   │
│   ├── inventory-service/           # Products, categories, stock, media
│   │   └── src/{db,excel,grpc,handlers,storage}/
│   │       # handlers/ own the Redis read-through cache directly —
│   │       # cacheGet/cacheSet on read, cacheDel/cacheDelPattern on write
│   │
│   └── customer-service/            # Auth, profile, cart, public reads
│       └── src/{auth,db,grpc-clients,grpc,handlers}/
│           # grpc-clients/: proxies inventory reads for public/cart enrichment
│           # auth/: refresh tokens stored in Redis (separate keyspace from
│           # inventory cache — see shared/src/auth/rotate-refresh-token.ts)
│
├── infrastructure/                  # Shared runtime infra, imported via @infrastructure/*
│   ├── database/
│   │   └── mysql.ts                # connection pool (app DB_USER — least privilege)
│   ├── redis/redis.ts               # client, cacheGet/Set/Del, TTL + CacheKey constants
│   ├── storage/rustfs.ts
│   ├── observability/
│   │   ├── tracing.ts               # OTel SDK init — self-contained dotenv load,
│   │   │                             # reads SERVICE_NAME before any -r preload ordering matters
│   │   ├── metrics.ts               # prom-client registry, HTTP/gRPC/cache metrics
│   │   ├── metrics-server.ts        # standalone :PORT/metrics HTTP server
│   │   ├── logger.ts
│   │   └── audit.ts                 # centralized audit log writer
│   └── prometheus.yml
│
├── proto/                           # Shared .proto definitions
│   ├── common.proto                 # StatusResponse, Pagination
│   ├── admin.proto                  # AdminService + inventory-proxying RPCs
│   ├── inventory.proto              # InventoryService + all message types
│   └── customer.proto                # CustomerService + public read RPCs
│
├── shared/                          # Shared TypeScript library (@shared/*)
│   └── src/
│       ├── auth/                    # jwt.ts (RS256), password.ts (bcrypt), refresh-token.ts
│       ├── grpc/
│       │   ├── client-factory.ts    # getGrpcClient() — memoized per service name
│       │   ├── call-grpc.ts         # callGrpc() — Promise wrapper over callback-style stubs
│       │   ├── inventory.client.ts  # the single shared Inventory client factory —
│       │   │                        # instantiated by Admin/Customer Service, never Gateway
│       │   └── proto-loader.ts      # cached @grpc/proto-loader package loaders
│       ├── errors/                  # AppError, gRPC status ↔ HTTP status mapping
│       ├── validation/              # Zod schemas — admin, customer, inventory
│       ├── constants/                # roles.ts, permission.ts, status.ts
│       └── types/
│
├── migrations/                      # Knex migrations (6 tables) — app DB_USER only.
│                                     # Server-level DDL (CREATE USER/GRANT) is out of scope
│                                     # here by design.
├── seeds/                           # Super admin seed script
├── scripts/                         # One-off ops scripts
├── tests/
│   ├── integration/                 # requires running services
│   └── unit/                        # no infrastructure required
├── docker-compose.yml
├── knexfile.ts
└── jest.config.ts
```

---

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- npm 9+

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd ecommerce-site_Inventory-Management

# Root
npm install

# Each service
cd gateway                    : npm install : cd ..
cd services/admin-service     : npm install : cd ../..
cd services/inventory-service : npm install : cd ../..
cd services/customer-service  : npm install : cd ../..
```

### 2. Generate RS256 keypair

Run this once. Paste the output into your `.env` files.

```bash
node -e "
const { generateKeyPairSync } = require('crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log('PRIVATE KEY:');
console.log(privateKey.replace(/\n/g, '\\\\n'));
console.log('\nPUBLIC KEY:');
console.log(publicKey.replace(/\n/g, '\\\\n'));
"
```

### 3. Configure environment files

Create `.env` files per service. See [Environment Variables](#environment-variables).

### 4. Start core infrastructure

```bash
docker compose up -d mysql redis rustfs
docker compose ps   # wait for all three to show healthy
```

### 5. Run migrations and seed

```bash
npm run migrate:latest
npm run seed:run
```

The seed script reads `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD` from the root `.env`. Set these before running.

### 6. Start observability sinks (optional, for tracing/metrics)

```bash
docker compose up -d jaeger prometheus
```

Jaeger UI: `http://localhost:16686`. Prometheus: `http://localhost:9090`. Each service also exposes its own `/metrics` endpoint directly (see [Observability](#observability)).

### 7. Start services

Open four terminals:

```bash
# Terminal 1 — Inventory Service first (others depend on it)
cd services/inventory-service : npm run dev

# Terminal 2 — Admin Service
cd services/admin-service : npm run dev

# Terminal 3 — Customer Service
cd services/customer-service : npm run dev

# Terminal 4 — Gateway
cd gateway : npm run dev
```

Gateway is available at `http://localhost:3000`.

---

## Environment Variables

### Root `.env` — Docker Compose provisioning only

```bash
DB_ROOT_PASSWORD=
DB_NAME=ecommerce
DB_USER=
DB_PASSWORD=
REDIS_PORT=6379
RUSTFS_PORT=9000
RUSTFS_ACCESS_KEY=
RUSTFS_SECRET_KEY=

# Seed only
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
```

### `gateway/.env`

```bash
GATEWAY_PORT=3000
CORS_ORIGIN=http://localhost:5173
ADMIN_SERVICE_HOST=localhost
ADMIN_SERVICE_PORT=50051
INVENTORY_SERVICE_HOST=localhost
INVENTORY_SERVICE_PORT=50052
CUSTOMER_SERVICE_HOST=localhost
CUSTOMER_SERVICE_PORT=50053
JWT_PRIVATE_KEY=        # RS256 private key — Gateway only
JWT_PUBLIC_KEY=         # RS256 public key
JWT_EXPIRES_IN_ADMIN=8h
JWT_EXPIRES_IN_CUSTOMER=24h
SERVICE_NAME=gateway
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
METRICS_PORT=9101
```

### `services/admin-service/.env`

```bash
ADMIN_SERVICE_PORT=50051
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecommerce
DB_USER=
DB_PASSWORD=
INVENTORY_SERVICE_HOST=localhost
INVENTORY_SERVICE_PORT=50052
SERVICE_NAME=admin-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
METRICS_PORT=9102
```

### `services/inventory-service/.env`

```bash
INVENTORY_SERVICE_PORT=50052
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecommerce
DB_USER=
DB_PASSWORD=
REDIS_HOST=localhost
REDIS_PORT=6379
RUSTFS_ENDPOINT=http://localhost:9000
RUSTFS_ACCESS_KEY=
RUSTFS_SECRET_KEY=
RUSTFS_BUCKET=products
SERVICE_NAME=inventory-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
METRICS_PORT=9103
```

### `services/customer-service/.env`

```bash
CUSTOMER_SERVICE_PORT=50053
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecommerce
DB_USER=
DB_PASSWORD=
REDIS_HOST=localhost
REDIS_PORT=6379
INVENTORY_SERVICE_HOST=localhost
INVENTORY_SERVICE_PORT=50052
OAUTH_SUPPORTED_PROVIDERS=google
OAUTH_GOOGLE_CLIENT_ID=
SERVICE_NAME=customer-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
METRICS_PORT=9104
```

> **Security:** `JWT_PRIVATE_KEY` lives in Gateway only. All other services receive `JWT_PUBLIC_KEY` only. Never commit any `.env` file.
>
> `SERVICE_NAME` values are hyphenated (`inventory-service`) — this is intentional and preferred for the OTel resource attribute / trace label. Hyphens are invalid in Prometheus metric names, so `metrics.ts` sanitizes `SERVICE_NAME` into a separate valid prefix internally; don't "fix" this by renaming the env values.

---

## Database

### Migrations

```bash
npm run migrate:latest      # Apply all pending migrations
npm run migrate:rollback    # Roll back last batch
npm run migrate:status      # Show migration status
```

### Tables

| Table         | Description                         |
| ------------- | ----------------------------------- |
| `admin_users` | Admin accounts with RBAC roles      |
| `categories`  | Product categories                  |
| `products`    | Product catalog with stock tracking |
| `customers`   | Customer accounts (email + OAuth)   |
| `cart_items`  | Authenticated customer cart         |
| `audit_logs`  | Centralized mutation audit trail    |

---

## Caching

Redis is a read-through cache owned entirely by Inventory Service — no separate consumer or async propagation step:

- **Read:** `cacheGet(CacheKey.*)` → on miss, read MySQL → `cacheSet(..., TTL.*)`.
- **Write:** MySQL write, then `cacheDel`/`cacheDelPattern` for the affected keys in the same handler.

Customer Service only reads these keys (via its Inventory client) and falls through on miss — it never sets them directly.

### Cache keys

| Cache Key                                   | Data           | TTL    | Written by        |
| ------------------------------------------- | -------------- | ------ | ----------------- |
| `product:{id}`                              | Single product | 10 min | inventory-service |
| `products:list:{categoryId}:{page}:{limit}` | Product list   | 5 min  | inventory-service |
| `categories:all`                            | All categories | 30 min | inventory-service |
| `stock:{productId}`                         | Stock level    | 1 min  | inventory-service |

Refresh tokens use a separate Redis keyspace (`shared/src/auth/rotate-refresh-token.ts`) — unrelated to the cache keys above, no shared TTL or eviction policy between the two.

---

## Observability

Every service (Gateway, Admin, Inventory, Customer) initializes the same shared modules from `infrastructure/observability/`:

- **Tracing** (`tracing.ts`): OTel SDK, auto-instruments `express`/`mysql2`/`ioredis`/`@grpc/grpc-js`. Exports OTLP/HTTP to Jaeger at `OTEL_EXPORTER_OTLP_ENDPOINT`. Loads its own `dotenv.config()` internally rather than relying on `-r` preload ordering, so `SERVICE_NAME` is guaranteed to be populated before the resource attribute is set, regardless of how the process was launched.
- **Metrics** (`metrics.ts` + `metrics-server.ts`): `prom-client` registry with HTTP, gRPC, and Redis cache hit/miss metrics, all prefixed by a Prometheus-sanitized version of `SERVICE_NAME`. Each service exposes its own `:METRICS_PORT/metrics` endpoint, scraped independently by Prometheus (`infrastructure/prometheus.yml`) — not proxied through the Gateway.
- **Audit** (`audit.ts`): centralized writer to the `audit_logs` table. Called explicitly at mutation points — notably at the Admin Service's inventory-delegation layer, so proxied inventory writes are attributed to the acting admin, not logged as if Inventory Service acted autonomously.

---

## API Routes

### Admin Auth

| Method | Path                      | Auth                | Description                        |
| ------ | ------------------------- | ------------------- | ---------------------------------- |
| POST   | `/api/admin/auth/login`   | none (rate-limited) | Login, returns JWT + refresh token |
| POST   | `/api/admin/auth/refresh` | refresh token       | Rotate access token                |
| POST   | `/api/admin/auth/logout`  | refresh token       | Revoke refresh token               |
| GET    | `/api/admin/auth/me`      | admin JWT           | Session restoration                |

### Admin Users — `super_admin` only

| Method | Path                          | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| GET    | `/api/admin/users`            | List users (paginated)        |
| POST   | `/api/admin/users`            | Create maintainer or reporter |
| PUT    | `/api/admin/users/:id`        | Update user                   |
| DELETE | `/api/admin/users/:id`        | Delete user                   |
| PATCH  | `/api/admin/users/:id/status` | Toggle active status          |

### Admin Inventory — `super_admin` + `maintainer` (proxied to Inventory Service via Admin Service)

| Method | Path                                      | Description                    |
| ------ | ----------------------------------------- | ------------------------------ |
| POST   | `/api/admin/inventory/categories`         | Create category                |
| GET    | `/api/admin/inventory/categories`         | List categories                |
| POST   | `/api/admin/inventory/products`           | Create product                 |
| GET    | `/api/admin/inventory/products`           | List products by category      |
| GET    | `/api/admin/inventory/products/:id`       | Get product                    |
| PUT    | `/api/admin/inventory/products/:id`       | Update product                 |
| DELETE | `/api/admin/inventory/products/:id`       | Soft delete product            |
| PATCH  | `/api/admin/inventory/products/:id/stock` | Update stock (delta)           |
| POST   | `/api/admin/inventory/bulk-upload`        | Bulk upload via Excel + images |

### Public — no auth required (served via Customer Service, cache-backed)

| Method | Path                            | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/api/categories`               | List all categories            |
| GET    | `/api/products?category={slug}` | List products by category slug |
| GET    | `/api/products/:id`             | Get single product             |

### Customer Auth

| Method | Path                          | Auth                | Description                    |
| ------ | ----------------------------- | ------------------- | ------------------------------ |
| POST   | `/api/customer/auth/register` | none (rate-limited) | Register with email + password |
| POST   | `/api/customer/auth/login`    | none (rate-limited) | Login with email + password    |
| POST   | `/api/customer/auth/oauth`    | none (rate-limited) | Login or register via OAuth    |
| POST   | `/api/customer/auth/refresh`  | refresh token       | Rotate access token            |
| POST   | `/api/customer/auth/logout`   | refresh token       | Revoke refresh token           |

### Customer — requires customer JWT

| Method | Path                            | Description            |
| ------ | ------------------------------- | ---------------------- |
| GET    | `/api/customer/profile`         | Get profile            |
| PUT    | `/api/customer/profile`         | Update first/last name |
| GET    | `/api/customer/cart`            | Get enriched cart      |
| POST   | `/api/customer/cart`            | Add item to cart       |
| PUT    | `/api/customer/cart/:productId` | Set item quantity      |
| DELETE | `/api/customer/cart/:productId` | Remove item from cart  |

---

## Admin Roles

| Role          | Type   | Permissions                                               |
| ------------- | ------ | --------------------------------------------------------- |
| `super_admin` | Type 1 | Full control — user management + all inventory operations |
| `maintainer`  | Type 2 | Inventory CRUD, bulk upload                               |
| `reporter`    | Type 2 | Inventory read only                                       |

---

## Testing

### Unit tests — no infrastructure required

```bash
npm run test:unit
```

Covers: shared lib (JWT, password, errors, Redis keys, audit), gateway auth middleware, all service handlers (admin, customer, inventory), Excel parser.

### Integration tests — all services must be running

Create `tests/integration/.env.test.local` with all required values (see `.env.example` for the full list including `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD`).

```bash
npm run test:integration
```

Covers: admin auth, admin user lifecycle, inventory CRUD + role enforcement, public product/category reads, customer registration/login/profile/cart full lifecycle.

### Coverage report

```bash
npm run test:coverage
```

Thresholds: 60% branches, 70% functions, 70% lines.

---

## Bulk Upload

`POST /api/admin/inventory/bulk-upload` accepts `multipart/form-data`:

| Field    | Type                 | Description        |
| -------- | -------------------- | ------------------ |
| `excel`  | `.xlsx` file         | Product data       |
| `images` | Multiple image files | Mapped by filename |

**Excel column schema:**

```
name | description | price | stock_quantity | category_slug | thumbnail_filename | list_image_filename
```

- Rows are validated individually — a single row failure does not abort the upload
- Images are matched to rows by filename
- Returns `{ total, success, failed, errors[] }`

---

## Docker

### Development infrastructure only

```bash
docker compose up -d mysql redis rustfs jaeger prometheus
docker compose down
```

### Full stack (all services, containerized)

```bash
docker compose up -d --build
```

### Service dependency order

```
MySQL (healthy) ──┐
Redis (healthy) ──┤──► Inventory Service
RustFS (healthy) ─┘         │
                             ├──► Admin Service
                             └──► Customer Service

Admin Service ──┐
Customer Service ┤──► Gateway
Inventory Service ┘
```

---

## Git Workflow

Branches: `main` → `dev` → `feature/*` / `fix/*` / `chore/*`

```bash
# Start new work
git checkout dev && git pull origin dev
git checkout -b feature/{service}-{description}

# Commit
git commit -m "feat({scope}): imperative description"

# Stay current
git fetch origin && git rebase origin/dev

# Push and open PR targeting dev
git push origin feature/{service}-{description}
```

PRs require 1 approval. Squash and merge into `dev`. Only `dev → main` merges use merge commits.

---

## Release Tags

| Tag      | Content                                                       |
| -------- | ------------------------------------------------------------- |
| `v0.1.0` | Proto + shared lib + DB migrations                            |
| `v0.2.0` | Admin Service + Gateway admin routes                          |
| `v0.3.0` | Inventory Service (CRUD + RustFS)                             |
| `v0.4.0` | Customer Service (auth + cart)                                |
| `v0.5.0` | Bulk upload                                                   |
| `v1.0.0` | All phases complete — 138 unit + 65 integration tests passing |

---

## Out of Scope (Phase 1)

- Payment processing
- Order management
- Email notifications
- Admin reporting dashboards (data model ready, UI deferred)
- Customer email change flow
- TLS for inter-service gRPC communication
