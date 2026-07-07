import { z } from "zod";

export const AuditEntityTypeEnum = z.enum(["admin_user", "product", "category"]);
export const AuditActionEnum = z.enum(["create", "update", "delete"]);

export const ListAuditLogsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  entity_type: AuditEntityTypeEnum.optional(),
  action: AuditActionEnum.optional(),
});

export const ListAuditLogsGrpcSchema = z.object({
  pagination: z
    .object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .optional(),
  entity_type: AuditEntityTypeEnum.optional(),
  action: AuditActionEnum.optional(),
});

export const UploadImageSchema = z.object({
  image_type: z.enum(["thumbnail", "list_image"]).optional().default("thumbnail"),
});

export const GetInventoryStatsSchema = z.object({
  low_stock_threshold: z.coerce.number().int().positive().max(1000).optional(),
});
