# E-Commerce Platform with Inventory Management

Monorepo — TypeScript · Express · gRPC · MySQL · Redis · RustFS

## Services

| Service           | Port  | Responsibility                            |
| ----------------- | ----- | ----------------------------------------- |
| Gateway           | 3000  | API entry point, auth middleware, routing |
| Admin Service     | 50051 | RBAC, admin user management               |
| Inventory Service | 50052 | Products, categories, stock, media        |
| Customer Service  | 50053 | Auth, profile, cart                       |

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker Desktop

## Getting Started

\`\`\`bash

# Copy and fill env vars

cp .env.example .env

# Start infrastructure

npm run docker:up

# Install all dependencies

npm install
\`\`\`

## Branch Strategy

- \`main\` — production only, PR required, 1 approval
- \`dev\` — integration branch, PR required, 1 approval
- \`feature/{service}-{description}\` — active development

See \`git_guide.md\` in project docs for full convention.
