export type AdminRole = "super_admin" | "maintainer" | "reporter";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntityType = "admin_user" | "product" | "category";

export type ValidateTarget = "body" | "params" | "query";

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  stock_quantity: number;
  thumbnail_url: string | null;
  list_image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: string;
  email: string;
  password_hash: string | null;
  oauth_provider: string | null;
  oauth_id: string | null;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OAuthProfile {
  oauth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  oauth_provider: string;
}

export interface EnrichedCartItem {
  product_id: string;
  product_name: string;
  price: string;
  thumbnail_url: string | null;
  quantity: number;
  stock_quantity: number;
}

export interface AuditLog {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  performed_by: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export type AuditLogEntry = Omit<
  AuditLog,
  "id" | "created_at" | "metadata" | "ip_address"
> & {
  metadata?: Record<string, unknown>;
  ip_address?: string;
};

export interface AdminJWTPayload {
  admin_id: string;
  role: AdminRole;
  exp: number;
}

export interface CustomerJWTPayload {
  customer_id: string;
  exp: number;
}

export interface RefreshCookieConfig {
  name: string;
  maxAgeMs: number;
}

export interface RotateRefreshTokenParams<TUser> {
  refreshToken: string;
  cacheKey: (userId: string, deviceId: string) => string;
  ttlSeconds: number;
  gracePeriodSeconds: number;
  findUser: (userId: string) => Promise<TUser | null>;
  isActive: (user: TUser) => boolean;
}

export interface RotateRefreshTokenResult<TUser> {
  userId: string;
  deviceId: string;
  refreshToken: string;
  user: TUser;
  /** false when this call served a replayed previous_token during the grace window rather than issuing a new one */
  rotated: boolean;
}

export interface RefreshTokenPayload {
  token: string;
  previous_token?: string;
  previous_token_expires_at?: number;
  role?: string;
  device_pixel_ratio: number;
  created_at: string;
}

export type ImageType = "thumbnail" | "list_image";

export interface ImageFile {
  filename: string;
  data: Buffer;
  mime_type: string;
}

export interface ParsedProductRow {
  rowNumber: number;
  name: string;
  description: string;
  price: string;
  stock_quantity: number;
  category_slug: string;
  thumbnail_filename: string | null;
  list_image_filename: string | null;
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParseResult {
  validRows: ParsedProductRow[];
  errors: RowError[];
}
