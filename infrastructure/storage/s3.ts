import * as Minio from "minio";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";

let client: Minio.Client | null = null;

export function getRustFSClient(): Minio.Client {
  if (client) return client;

  const endpoint = process.env.RUSTFS_ENDPOINT;
  if (!endpoint) throw new Error("RUSTFS_ENDPOINT is not set");

  const url = new URL(endpoint);

  client = new Minio.Client({
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 9000,
    useSSL: url.protocol === "https:",
    accessKey: process.env.RUSTFS_ACCESS_KEY ?? "",
    secretKey: process.env.RUSTFS_SECRET_KEY ?? "",
  });

  return client;
}

export async function ensureBucket(bucketName: string): Promise<void> {
  const client = getRustFSClient();
  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName);
    await client.setBucketPolicy(
      bucketName,
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      })
    );
    logger.info(SERVICE_NAME, "Created RustFS/MinIO bucket", { bucketName });
  }
}
