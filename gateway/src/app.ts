import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import inventoryRouter from "./routes/inventory.routes";
import adminRouter from "./routes/admin.routes";
import publicRouter from "./routes/public.routes";
import customerRouter from "./routes/customer.routes";
import { grpcErrorHandler } from "./middleware/error.middleware";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: "Too many requests — try again later" },
  })
);

app.use("/api/admin/inventory", inventoryRouter);
app.use("/api/admin", adminRouter);
app.use("/api/customer", customerRouter);
app.use("/api", publicRouter);

app.use(grpcErrorHandler);

export default app;
