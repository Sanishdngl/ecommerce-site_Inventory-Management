import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { trace, context } from "@opentelemetry/api";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";
const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces";
const TRACING_ENABLED = process.env.TRACING_ENABLED !== "false";

let initialized = false;

// Initialize at service boot — import first for auto‑instrumentation
// (before express,mysql2, ioredis, grpc are imported)
export function initTracing(): void {
  if (initialized) return;
  if (!TRACING_ENABLED) {
    console.log(`[tracing] disabled for ${SERVICE_NAME}`);
    initialized = true;
    return;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
    }),
    traceExporter: new OTLPTraceExporter({ url: OTLP_ENDPOINT }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation — too noisy
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();
  initialized = true;
  console.log(`[tracing] initialized for ${SERVICE_NAME} → ${OTLP_ENDPOINT}`);

  process.on("SIGTERM", () => {
    sdk?.shutdown().finally(() => process.exit(0));
  });
}

// Get current trace context — correlate logs with traces
export function getCurrentTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId;
}

initTracing();