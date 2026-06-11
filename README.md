# E-Commerce + Inventory Management — Backend

A production-structured microservices backend for an e-commerce platform with integrated inventory management. Built with TypeScript, Express, gRPC, MySQL, Redis, and RustFS.

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
   ┌────┴────┐
   ▼         ▼
 MySQL     Redis
         RustFS
```

**Routing contract:**

- `Gateway → Admin Service → Inventory Service` for all admin inventory operations
- `Gateway → Customer Service → Inventory Service` for all public reads and cart enrichment
- Inventory Service is never called directly by the Gateway

---

## Tech Stack

| Layer          | Technology                     |
| -------------- | ------------------------------ |
| Gateway        | Express + Node.js (TypeScript) |
| Services       | gRPC (TypeScript)              |
| Database       | MySQL 8                        |
| Cache          | Redis 7                        |
| Object Storage | RustFS                         |
| Auth           | JWT (RS256)                    |
| Passwords      | bcrypt                         |

---

## Project Structure

```
/
├── gateway/                        # Express API Gateway
│   ├── src/
│   │   ├── controllers/            # Route handlers (admin, inventory, customer, public)
│   │   ├── grpc-clients/           # Lazy-init gRPC client factories
│   │   ├── middleware/             # Auth, error, upload middleware
│   │   └── routes/                 # Express router definitions
│   └── Dockerfile
│
├── services/
│   ├── admin-service/              # Admin user management + RBAC
│   │   └── src/
│   │       ├── db/                 # MySQL queries
│   │       ├── grpc-clients/       # Inventory Service client
│   │       ├── grpc/               # gRPC server setup
│   │       └── handlers/           # Admin + inventory delegation handlers
│   │
│   ├── inventory-service/          # Products, categories, stock, media
│   │   └── src/
│   │       ├── db/                 # MySQL queries
│   │       ├── excel/              # Bulk upload Excel parser
│   │       ├── grpc/               # gRPC server setup
│   │       ├── handlers/           # Category, product, bulk, image handlers
│   │       └── storage/            # RustFS client
│   │
│   └── customer-service/           # Auth, profile, cart, public reads
│       └── src/
│           ├── auth/               # OAuth token verification
│           ├── db/                 # MySQL queries
│           ├── grpc-clients/       # Inventory Service client
│           ├── grpc/               # gRPC server setup
│           └── handlers/           # Auth, profile, cart, public handlers
│
├── proto/                          # Shared .proto definitions
│   ├── common.proto                # Shared messages (StatusResponse, Pagination)
│   ├── admin.proto                 # AdminService + inventory delegation RPCs
│   ├── inventory.proto             # InventoryService + all message types
│   └── customer.proto              # CustomerService + public read RPCs
│
├── shared/                         # Shared TypeScript library
│   └── src/
│       ├── audit.ts                # Centralized audit log writer
│       ├── db.ts                   # MySQL connection pool
│       ├── errors.ts               # ServiceError, handle wrapper, gRPC→HTTP map
│       ├── index.ts                # Barrel export
│       ├── jwt.ts                  # RS256 sign/verify
│       ├── password.ts             # bcrypt hash/verify
│       ├── proto-loader.ts         # Cached proto package loaders
│       ├── redis.ts                # Redis client, cache helpers, TTL/CacheKey constants
│       └── types.ts                # All shared TypeScript interfaces
│
├── migrations/                     # Knex DB migrations (6 tables)
├── seeds/                          # Super admin seed script
├── tests/
│   ├── integration/                # Integration tests (requires running services)
│   │   ├── gateway/                # admin, admin-users, inventory, customer, public
│   │   └── helpers/                # Auth helpers, cleanup utilities
│   └── unit/                       # Unit tests (no infrastructure required)
│       ├── admin/
│       ├── customer/
│       ├── gateway/
│       ├── inventory/
│       └── shared/
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

Create `.env` files per service. See the [Environment Variables](#environment-variables) section below.

### 4. Start infrastructure

```bash
docker compose up -d mysql redis rustfs
```

Wait for all three to show `healthy`:

```bash
docker compose ps
```

### 5. Run migrations and seed

```bash
npm run migrate:latest
npm run seed:run
```

The seed script reads `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD` from the root `.env`. Set these before running.

### 6. Start services

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
```

> **Security:** `JWT_PRIVATE_KEY` lives in Gateway only. All other services receive `JWT_PUBLIC_KEY` only. Never commit any `.env` file.

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

## API Routes

### Admin Auth

| Method | Path                    | Description        |
| ------ | ----------------------- | ------------------ |
| POST   | `/api/admin/auth/login` | Login, returns JWT |

### Admin Users — `super_admin` only

| Method | Path                          | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| GET    | `/api/admin/users`            | List users (paginated)        |
| POST   | `/api/admin/users`            | Create maintainer or reporter |
| PUT    | `/api/admin/users/:id`        | Update user                   |
| DELETE | `/api/admin/users/:id`        | Delete user                   |
| PATCH  | `/api/admin/users/:id/status` | Toggle active status          |

### Admin Inventory — `super_admin` + `maintainer`

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

### Public — No auth required

| Method | Path                            | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/api/categories`               | List all categories            |
| GET    | `/api/products?category={slug}` | List products by category slug |
| GET    | `/api/products/:id`             | Get single product             |

### Customer Auth

| Method | Path                          | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| POST   | `/api/customer/auth/register` | Register with email + password |
| POST   | `/api/customer/auth/login`    | Login with email + password    |
| POST   | `/api/customer/auth/oauth`    | Login or register via OAuth    |

### Customer — Requires customer JWT

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

## Caching Strategy (Redis)

| Cache Key                                   | Data           | TTL    |
| ------------------------------------------- | -------------- | ------ |
| `product:{id}`                              | Single product | 10 min |
| `products:list:{categoryId}:{page}:{limit}` | Product list   | 5 min  |
| `categories:all`                            | All categories | 30 min |
| `stock:{productId}`                         | Stock level    | 1 min  |
| `cart:{customerId}`                         | Customer cart  | 24h    |

All write operations invalidate the relevant cache keys.

---

## Testing

### Unit tests — no infrastructure required

```bash
npm run test:unit
```

Covers: shared lib (JWT, password, errors, Redis keys, audit), gateway auth middleware, all service handlers (admin, customer, inventory), Excel parser.

**138 tests across 13 suites.**

### Integration tests — all services must be running

Create `tests/integration/.env.test.local` with all required values (see `.env.example` for the full list including `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD`).

```bash
npm run test:integration
```

Covers: admin auth, admin user lifecycle, inventory CRUD + role enforcement, public product/category reads, customer registration/login/profile/cart full lifecycle.

**65 tests across 5 suites.**

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
docker compose up -d mysql redis rustfs
docker compose down
```

### Full stack (all services)

```bash
docker compose up -d --build
```

### Service dependency order

```
MySQL (healthy) ──┐
Redis (healthy) ──┤──► Inventory Service
RustFS (healthy) ─┘
                        │
                        ├──► Admin Service
                        └──► Customer Service
                                    │
                                    └──► Gateway
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
- JWT token refresh and revocation
- Customer email change flow
- TLS for inter-service gRPC communication
