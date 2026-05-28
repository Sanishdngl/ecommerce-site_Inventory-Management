import type { Request, Response, NextFunction } from "express";
import { adminClient } from "../grpc-clients/admin.client";
import { callGrpc, buildMeta } from "../grpc-clients/index";
import { signAdminJWT } from "@shared/jwt";

export async function loginAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: "username and password are required" });
      return;
    }

    const response = await callGrpc<any, any>(adminClient, "LoginAdmin", {
      username,
      password,
    });

    const token = signAdminJWT({
      admin_id: response.user.id,
      role: response.user.role,
    });

    res.status(200).json({ token, user: response.user });
  } catch (err) {
    next(err);
  }
}

export async function listAdminUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const response = await callGrpc<any, any>(
      adminClient,
      "ListAdminUsers",
      { pagination: { page, limit } },
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function createAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, email, password, role } = req.body;

    const response = await callGrpc<any, any>(
      adminClient,
      "CreateAdminUser",
      { username, email, password, role },
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, email, role } = req.body;

    const response = await callGrpc<any, any>(
      adminClient,
      "UpdateAdminUser",
      { id: req.params.id, username, email, role },
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const response = await callGrpc<any, any>(
      adminClient,
      "DeleteAdminUser",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function toggleAdminStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const response = await callGrpc<any, any>(
      adminClient,
      "ToggleAdminStatus",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
