import type { Request, Response, NextFunction } from "express";
import { getAdminClient } from "../grpc-clients/admin.client";
import { callGrpc, buildMeta } from "@shared/grpc/call-grpc";
import { signAdminJWT } from "@shared/auth/jwt";
import type { AdminRole } from "@shared/types";
import { normalizeRole, toProtoRole } from "@shared/constants/roles";
import {
  ADMIN_REFRESH_COOKIE,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  requireRefreshTokenCookie,
} from "@shared/utils/cookies";

function normalizeUser(user: any) {
  if (!user) return user;
  return {
    ...user,
    role: normalizeRole(user.role),
  };
}

export async function loginAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, password, device_id, device_pixel_ratio } = req.body;

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(adminClient, "LoginAdmin", {
      username,
      password,
      device_id,
      device_pixel_ratio: device_pixel_ratio ?? 1,
    });

    const normalized = normalizeUser(response.user);

    const token = signAdminJWT({
      admin_id: normalized.id,
      role: normalized.role as AdminRole,
    });

    setRefreshTokenCookie(res, ADMIN_REFRESH_COOKIE, response.refresh_token);

    res.status(200).json({ token, user: normalized });
  } catch (err) {
    next(err);
  }
}

export async function refreshAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refresh_token = requireRefreshTokenCookie(req, ADMIN_REFRESH_COOKIE);

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(adminClient, "RefreshToken", {
      refresh_token,
    });

    const normalized = normalizeUser(response.user);
    const token = signAdminJWT({
      admin_id: response.admin_id,
      role: normalized.role as AdminRole,
    });

    setRefreshTokenCookie(res, ADMIN_REFRESH_COOKIE, response.refresh_token);

    res.status(200).json({ token, user: normalized });
  } catch (err) {
    next(err);
  }
}

export async function logoutAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = getRefreshTokenCookie(req, ADMIN_REFRESH_COOKIE);

    if (refreshToken) {
      const adminClient = getAdminClient();
      await callGrpc<any, any>(adminClient, "LogoutAdmin", {
        refresh_token: refreshToken,
      }).catch(() => {});
    }

    clearRefreshTokenCookie(res, ADMIN_REFRESH_COOKIE);
    res.status(200).json({ success: true });
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
    const page = (req.query.page as number | undefined) ?? 1;
    const limit = (req.query.limit as number | undefined) ?? 20;

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
      { username, email, password, role: toProtoRole(role) },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(201).json({ ...response, user: normalizeUser(response.user) });
  } catch (err) {
    next(err);
  }
}

export async function getAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "GetAdminUser",
      { id: req.params.id },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(200).json({ ...response, user: normalizeUser(response.user) });
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
    const { username, email, password, role } = req.body;

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "UpdateAdminUser",
      {
        id: req.params.id,
        username,
        email,
        password,
        role: toProtoRole(role),
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
