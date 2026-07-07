import "dotenv/config";
import "@infrastructure/observability/tracing";
import app from "./app";
import { logger } from "@infrastructure/observability/logger";

const PORT = parseInt(process.env.GATEWAY_PORT ?? "3000", 10);

app.listen(PORT, () => {
  logger.info("gateway", `Running on port ${PORT}`);
});
