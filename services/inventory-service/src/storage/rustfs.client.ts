import * as Minio from "minio";

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

export function getBucket(): string {
  const bucket = process.env.RUSTFS_BUCKET;
  if (!bucket) throw new Error("RUSTFS_BUCKET is not set");
  return bucket;
}

export type ImageType = "thumbnail" | "list_image";

function objectKey(
  productId: string,
  imageType: ImageType,
  ext: string
): string {
  return `products/${productId}/${imageType}.${ext}`;
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType] ?? "jpg";
}

export async function uploadProductImage(
  productId: string,
  imageType: ImageType,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const rustfs = getRustFSClient();
  const bucket = getBucket();
  const ext = extFromMime(mimeType);
  const key = objectKey(productId, imageType, ext);

  await rustfs.putObject(bucket, key, fileBuffer, fileBuffer.length, {
    "Content-Type": mimeType,
  });

  const endpoint = process.env.RUSTFS_ENDPOINT!;
  return `${endpoint}/${bucket}/${key}`;
}

export async function deleteProductImage(
  productId: string,
  imageType: ImageType,
  mimeType: string
): Promise<void> {
  const rustfs = getRustFSClient();
  const bucket = getBucket();
  const ext = extFromMime(mimeType);
  const key = objectKey(productId, imageType, ext);

  await rustfs.removeObject(bucket, key);
}

export async function ensureBucket(): Promise<void> {
  const rustfs = getRustFSClient();
  const bucket = getBucket();
  const exists = await rustfs.bucketExists(bucket);
  if (!exists) {
    await rustfs.makeBucket(bucket);
    console.log(`[rustfs] created bucket: ${bucket}`);
  }
}
