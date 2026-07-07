import http from "http";
import { registry } from "./metrics";
import { logger } from "./logger";

export function startMetricsServer(port: number, serviceName?: string): void {
  const name = serviceName ?? process.env.SERVICE_NAME ?? "service";

  http
    .createServer(async (req, res) => {
      if (req.url === "/metrics") {
        res.setHeader("Content-Type", registry.contentType);
        res.end(await registry.metrics());
        return;
      }
      res.statusCode = 404;
      res.end();
    })
    .listen(port, () => {
      logger.info(name, `Metrics server listening on port ${port}`);
    });
}
