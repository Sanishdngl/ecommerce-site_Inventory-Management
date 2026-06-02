import type { Request, Response, NextFunction } from "express";
import { inventoryClient } from "../grpc-clients/inventory.client";
import { streamToGrpc, buildMeta } from "../grpc-clients/index";

export async function bulkUploadProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const excelFiles = files["excel"];
    const imageFiles = files["images"] ?? [];

    if (!excelFiles || excelFiles.length === 0) {
      res.status(400).json({ message: "excel file is required" });
      return;
    }

    const messages: any[] = [
      { excel_data: excelFiles[0].buffer },
      ...imageFiles.map((img) => ({
        image: {
          filename: img.originalname,
          data: img.buffer,
          mime_type: img.mimetype,
        },
      })),
    ];

    const response = await streamToGrpc<any>(
      inventoryClient,
      "BulkUploadProducts",
      messages,
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
