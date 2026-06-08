import type { Request, Response, NextFunction } from "express";
import { getAdminClient } from "../grpc-clients/admin.client";
import { callGrpc, streamToGrpc, buildMeta } from "../grpc-clients/index";

export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, slug } = req.body;
    const response = await callGrpc<any, any>(
      getAdminClient,
      "CreateCategory",
      { name, slug },
      buildMeta(req.admin!.admin_id, req.ip)
    );
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function listCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const response = await callGrpc<any, any>(
      getAdminClient,
      "ListCategories",
      {}
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category_id, name, description, price, stock_quantity } = req.body;
    const response = await callGrpc<any, any>(
      getAdminClient,
      "CreateProduct",
      { category_id, name, description, price, stock_quantity },
      buildMeta(req.admin!.admin_id, req.ip)
    );
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category_id, name, description, price, is_active } = req.body;
    const response = await callGrpc<any, any>(
      getAdminClient,
      "UpdateProduct",
      { id: req.params.id, category_id, name, description, price, is_active },
      buildMeta(req.admin!.admin_id, req.ip)
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const response = await callGrpc<any, any>(
      getAdminClient,
      "DeleteProduct",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip)
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { category_id } = req.query;

    const response = await callGrpc<any, any>(getAdminClient, "ListProducts", {
      category_id,
      pagination: { page, limit },
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const response = await callGrpc<any, any>(getAdminClient, "GetProduct", {
      id: req.params.id,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateStock(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { delta } = req.body;
    const response = await callGrpc<any, any>(
      getAdminClient,
      "UpdateStock",
      { product_id: req.params.id, delta },
      buildMeta(req.admin!.admin_id, req.ip)
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

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
      getAdminClient,
      "BulkUploadProducts",
      messages,
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
