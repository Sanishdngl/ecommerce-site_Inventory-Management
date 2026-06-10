import type { Request, Response, NextFunction } from "express";
import { getAdminClient } from "../grpc-clients/admin.client";
import { callGrpc, buildMeta } from "../grpc-clients/index";
import { signAdminJWT } from "@shared/jwt";
import type { AdminRole } from "@shared/types";

const PROTO_ROLE_MAP: Record<string, AdminRole> = {
  SUPER_ADMIN: "super_admin",
  MAINTAINER: "maintainer",
  REPORTER: "reporter",
};

const APP_ROLE_TO_PROTO: Record<string, string> = {
  super_admin: "SUPER_ADMIN",
  maintainer: "MAINTAINER",
  reporter: "REPORTER",
};

function normalizeUser(user: any) {
  if (!user) return user;
  return {
    ...user,
    role: PROTO_ROLE_MAP[user.role] ?? user.role.toLowerCase(),
  };
}

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

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(adminClient, "LoginAdmin", {
      username,
      password,
    });

    const normalized = normalizeUser(response.user);

    const token = signAdminJWT({
      admin_id: normalized.id,
      role: normalized.role as AdminRole,
    });

    res.status(200).json({ token, user: normalized });
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

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "ListAdminUsers",
      { pagination: { page, limit } },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(200).json({
      ...response,
      users: response.users.map(normalizeUser),
    });
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

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "CreateAdminUser",
      { username, email, password, role: APP_ROLE_TO_PROTO[role] ?? role },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(201).json({ ...response, user: normalizeUser(response.user) });
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

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "UpdateAdminUser",
      {
        id: req.params.id,
        username,
        email,
        role: APP_ROLE_TO_PROTO[role] ?? role,
      },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(200).json({ ...response, user: normalizeUser(response.user) });
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "DeleteAdminUser",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
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
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "ToggleAdminStatus",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
