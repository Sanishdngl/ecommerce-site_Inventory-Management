import type { Request, Response, NextFunction } from "express";
import { inventoryClient } from "../grpc-clients/inventory.client";
import { callGrpc } from "../grpc-clients/index";

export async function listCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const response = await callGrpc<any, any>(
      inventoryClient,
      "ListCategories",
      {}
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
    const { category } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!category) {
      res.status(400).json({ message: "category slug is required" });
      return;
    }

    const categoriesResponse = await callGrpc<any, any>(
      inventoryClient,
      "ListCategories",
      {}
    );

    const matched = (categoriesResponse.categories as any[]).find(
      (c) => c.slug === category
    );

    if (!matched) {
      res.status(404).json({ message: `Category "${category}" not found` });
      return;
    }

    const response = await callGrpc<any, any>(inventoryClient, "ListProducts", {
      category_id: matched.id,
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
    const response = await callGrpc<any, any>(inventoryClient, "GetProduct", {
      id: req.params.id,
    });
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
