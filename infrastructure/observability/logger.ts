import winston from "winston";
import { getCurrentTraceId } from "./tracing";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const NODE_ENV = process.env.NODE_ENV ?? "development";

// Console output: JSON in prod, colored in dev
const productionFormat = combine(timestamp(), errors({ stack: true }), json());

const developmentFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${
      service ?? SERVICE_NAME
    }] ${level}: ${message}${metaStr}`;
  })
);

const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: SERVICE_NAME },
  format: NODE_ENV === "production" ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

// Public API: same signature, new import
type Meta = Record<string, unknown>;

// Attaches active trace_id (if a span is active) so log lines can be
// pivoted to the matching Jaeger trace. undefined trace_id is omitted
// by winston's json() formatter rather than logged as "undefined".
function withTrace(meta?: Meta): Meta {
  const traceId = getCurrentTraceId();
  return traceId ? { ...meta, trace_id: traceId } : { ...meta };
}

export const logger = {
  info: (service: string, message: string, meta?: Meta) =>
    winstonLogger.info(message, { service, ...withTrace(meta) }),

  warn: (service: string, message: string, meta?: Meta) =>
    winstonLogger.warn(message, { service, ...withTrace(meta) }),

  error: (service: string, message: string, meta?: Meta) => {
    winstonLogger.error(message, { service, ...withTrace(meta) });
  },

  debug: (service: string, message: string, meta?: Meta) =>
    winstonLogger.debug(message, { service, ...withTrace(meta) }),
};

// Raw logger instance — for advanced transports later
export { winstonLogger };
