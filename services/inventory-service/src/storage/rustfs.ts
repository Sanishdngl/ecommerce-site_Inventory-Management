import { getRustFSClient, ensureBucket } from "@infrastructure/storage/s3";
import { ImageType } from "@shared/types";

// Not exported — every consumer goes through the functions below.
function getBucket(): string {
  const bucket = process.env.RUSTFS_BUCKET;
  if (!bucket) throw new Error("RUSTFS_BUCKET is not set");
  return bucket;
}

function objectKey(
  productId: string,
  imageType: ImageType,
  ext: string
): string {
  return `products/${productId}/${imageType}.${ext}`;
}

export function extFromMime(mimeType: string): string {
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

// Takes the extension directly rather than a mime type — the caller only
// has the *previous* image's stored URL (mime type isn't persisted), so
// extFromUrl is how callers get here.
export async function deleteProductImage(
  productId: string,
  imageType: ImageType,
  ext: string
): Promise<void> {
  const rustfs = getRustFSClient();
  const bucket = getBucket();
  const key = objectKey(productId, imageType, ext);

  await rustfs.removeObject(bucket, key);
}

// Pulls the extension off a stored image URL
// (".../products/{id}/thumbnail.png" -> "png").
export function extFromUrl(url: string): string | undefined {
  return /\.([a-z0-9]+)$/i.exec(url)?.[1];
}

export async function ensureProductBucket(): Promise<void> {
  await ensureBucket(getBucket());
}
