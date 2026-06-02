import { v4 as uuidv4 } from "uuid";
import { getDb } from "@shared/db";
import { cacheDel, CacheKey } from "@shared/redis";
import { writeAuditLog } from "@shared/audit";
import {
  parseProductExcel,
  type ParsedProductRow,
  type RowError,
} from "../excel/parser";
import { findCategoryBySlug } from "../db/category.queries";
import { insertProduct } from "../db/product.queries";
import { uploadProductImage, type ImageType } from "../storage/rustfs.client";

interface ImageFile {
  filename: string;
  data: Buffer;
  mime_type: string;
}

export function bulkUploadProductsHandler(call: any, callback: any): void {
  let excelBuffer: Buffer | null = null;
  const imageFiles: ImageFile[] = [];

  call.on("data", (chunk: any) => {
    if (chunk.excel_data) {
      excelBuffer = Buffer.from(chunk.excel_data);
    } else if (chunk.image) {
      imageFiles.push({
        filename: chunk.image.filename,
        data: Buffer.from(chunk.image.data),
        mime_type: chunk.image.mime_type,
      });
    }
  });

  call.on("end", async () => {
    try {
      if (!excelBuffer) {
        callback({ code: 3, message: "Excel file is required" }, null);
        return;
      }

      const db = getDb();
      const performedBy = call.metadata?.get("admin_id")?.[0]
        ? String(call.metadata.get("admin_id")[0])
        : "system";
      const ipAddress = call.metadata?.get("ip_address")?.[0]
        ? String(call.metadata.get("ip_address")[0])
        : undefined;

      const { validRows, errors: parseErrors } = await parseProductExcel(
        excelBuffer
      );

      const imageMap = new Map<string, ImageFile>();
      for (const img of imageFiles) {
        imageMap.set(img.filename, img);
      }

      const slugCache = new Map<string, string>();
      const rowErrors: RowError[] = [...parseErrors];
      const processable: ParsedProductRow[] = [];

      for (const row of validRows) {
        if (slugCache.has(row.category_slug)) {
          processable.push(row);
          continue;
        }

        const category = await findCategoryBySlug(db, row.category_slug);
        if (!category) {
          rowErrors.push({
            row: row.rowNumber,
            message: `Category slug "${row.category_slug}" not found`,
          });
          continue;
        }

        slugCache.set(row.category_slug, category.id);
        processable.push(row);
      }

      let successCount = 0;
      const affectedCategoryIds = new Set<string>();
      const insertedProductIds: string[] = [];

      for (const row of processable) {
        try {
          const category_id = slugCache.get(row.category_slug)!;

          const product = await insertProduct(db, {
            category_id,
            name: row.name,
            description: row.description,
            price: row.price,
            stock_quantity: row.stock_quantity,
          });

          affectedCategoryIds.add(category_id);
          insertedProductIds.push(product.id);

          const imageUploads: [string | null, ImageType, string][] = [
            [row.thumbnail_filename, "thumbnail", "thumbnail_url"],
            [row.list_image_filename, "list_image", "list_image_url"],
          ];

          for (const [filename, imageType, column] of imageUploads) {
            if (!filename) continue;
            const imageFile = imageMap.get(filename);
            if (!imageFile) continue;

            const url = await uploadProductImage(
              product.id,
              imageType,
              imageFile.data,
              imageFile.mime_type
            );

            await db.execute(
              `UPDATE products SET ${column} = ?, updated_at = ? WHERE id = ?`,
              [url, new Date(), product.id]
            );
          }

          successCount++;
        } catch (err) {
          rowErrors.push({
            row: row.rowNumber,
            message: `Insert failed: ${(err as Error).message}`,
          });
        }
      }

      const keysToDelete: string[] = [];
      for (const categoryId of affectedCategoryIds) {
        keysToDelete.push(CacheKey.productList(categoryId));
      }
      for (const productId of insertedProductIds) {
        keysToDelete.push(CacheKey.stock(productId));
      }
      if (keysToDelete.length > 0) {
        await cacheDel(...keysToDelete);
      }

      const total = validRows.length + parseErrors.length;
      const failed = rowErrors.length;

      await writeAuditLog(db, {
        entity_type: "product",
        entity_id: uuidv4(),
        action: "create",
        performed_by: performedBy,
        metadata: { bulk_upload: true, total, success: successCount, failed },
        ip_address: ipAddress,
      });

      callback(null, {
        total,
        success: successCount,
        failed,
        errors: rowErrors,
      });
    } catch (err) {
      console.error("[inventory] bulk upload error:", err);
      callback(
        { code: 13, message: "Internal server error during bulk upload" },
        null
      );
    }
  });

  call.on("error", (err: Error) => {
    console.error("[inventory] bulk upload stream error:", err);
  });
}
