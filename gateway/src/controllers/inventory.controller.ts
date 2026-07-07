import type { Request, Response, NextFunction } from "express";
import { getAdminClient } from "../grpc-clients/admin.client";
import { callGrpc, streamToGrpc, buildMeta } from "@shared/grpc/call-grpc";

export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, slug } = req.body;
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "CreateCategory",
      { name, slug },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "ListCategories",
      {}
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(adminClient, "GetCategory", {
      id: req.params.id,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, slug } = req.body;
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "UpdateCategory",
      { id: req.params.id, name, slug },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "DeleteCategory",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "CreateProduct",
      { category_id, name, description, price, stock_quantity },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "UpdateProduct",
      { id: req.params.id, category_id, name, description, price, is_active },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "DeleteProduct",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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
    const page = (req.query.page as number | undefined) ?? 1;
    const limit = (req.query.limit as number | undefined) ?? 20;
    const category_id = req.query.category_id as string | undefined;

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "ListProducts",
      { ...(category_id ? { category_id } : {}), pagination: { page, limit } },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(adminClient, "GetProduct", {
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
    const { delta, reason } = req.body;
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "UpdateStock",
      { product_id: req.params.id, delta, reason },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function uploadProductImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "image file is required" });
      return;
    }

    const { image_type } = req.body;

    const messages = [
      {
        meta: {
          product_id: req.params.id,
          image_type,
          mime_type: file.mimetype,
        },
      },
      { chunk: file.buffer },
    ];

    const adminClient = getAdminClient();
    const response = await streamToGrpc<any>(
      adminClient,
      "UploadProductImage",
      messages,
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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

    const adminClient = getAdminClient();
    const response = await streamToGrpc<any>(
      adminClient,
      "BulkUploadProducts",
      messages,
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
