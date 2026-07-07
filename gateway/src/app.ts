import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import inventoryRouter from "./routes/inventory.routes";
import adminRouter from "./routes/admin.routes";
import systemRouter from "./routes/system.routes";
import publicRouter from "./routes/public.routes";
import customerRouter from "./routes/customer.routes";
import { grpcErrorHandler } from "./middleware/error.middleware";
import { globalRateLimiter } from "@shared/utils/rate-limits";
import {
  metricsMiddleware,
  metricsHandler,
} from "@infrastructure/observability/metrics";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(metricsMiddleware());

// Exposed ahead of the rate limiter — scraped by Prometheus, not a client.
app.get("/metrics", metricsHandler);

app.use(globalRateLimiter);

// Order matters: /api/admin/inventory must be registered before /api/admin,
// or Express would match the shorter prefix first and inventory routes
// would never be reached.
app.use("/api/admin/inventory", inventoryRouter);
app.use("/api/admin/system", systemRouter);
app.use("/api/admin", adminRouter);
app.use("/api/customer", customerRouter);
app.use("/api", publicRouter);

app.use(grpcErrorHandler);

export default app;
