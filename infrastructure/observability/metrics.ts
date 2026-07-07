import client from "prom-client";
import type { Request, Response } from "express";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";
const METRIC_PREFIX = SERVICE_NAME.replace(/[^a-zA-Z0-9_]/g, "_");

// Registry instance — one per process
export const registry = new client.Registry();
registry.setDefaultLabels({ service: SERVICE_NAME });
client.collectDefaultMetrics({
  register: registry,
  prefix: `${METRIC_PREFIX}_`,
});

// HTTP metrics — Gateway only
export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [registry],
});

// gRPC metrics — all services
export const grpcRequestDuration = new client.Histogram({
  name: "grpc_request_duration_seconds",
  help: "gRPC handler duration in seconds",
  labelNames: ["method", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [registry],
});

export const grpcRequestsTotal = new client.Counter({
  name: "grpc_requests_total",
  help: "Total gRPC requests",
  labelNames: ["method", "status"],
  registers: [registry],
});

// Cache metrics
export const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Total Redis cache hits",
  labelNames: ["key_type"],
  registers: [registry],
});

export const cacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Total Redis cache misses",
  labelNames: ["key_type"],
  registers: [registry],
});

// Helper: record metric by name (backward compatible)
export function recordMetric(name: string, value: number): void {
  // Escape hatch for ad-hoc gauges
  let gauge = (recordMetric as any)._gauges?.[name];
  if (!gauge) {
    gauge = new client.Gauge({
      name,
      help: `Ad-hoc metric: ${name}`,
      registers: [registry],
    });
    (recordMetric as any)._gauges = {
      ...(recordMetric as any)._gauges,
      [name]: gauge,
    };
  }
  gauge.set(value);
}

// Express middleware — wires HTTP metrics
export function metricsMiddleware() {
  return (req: Request, res: Response, next: () => void) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };

      httpRequestDuration.observe(labels, durationSec);
      httpRequestsTotal.inc(labels);
    });

    next();
  };
}

// /metrics endpoint handler
export async function metricsHandler(
  _req: Request,
  res: Response
): Promise<void> {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
}

// gRPC handler wrapper — records duration
export function withGrpcMetrics<T extends (...args: any[]) => Promise<any>>(
  methodName: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const start = process.hrtime.bigint();
    let status = "OK";
    try {
      return await fn(...args);
    } catch (err) {
      status = "ERROR";
      throw err;
    } finally {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      grpcRequestDuration.observe({ method: methodName, status }, durationSec);
      grpcRequestsTotal.inc({ method: methodName, status });
    }
  }) as T;
}
