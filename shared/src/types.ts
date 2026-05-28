export type AdminRole = "super_admin" | "maintainer" | "reporter";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntityType = "admin_user" | "product" | "category";

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
  password_hash: string | null; // null for OAuth-only accounts
  oauth_provider: string | null;
  oauth_id: string | null;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CartItem {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  added_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  performed_by: string; // FK → admin_users.id
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface AdminJWTPayload {
  admin_id: string;
  role: AdminRole;
  exp: number;
}

export interface CustomerJWTPayload {
  customer_id: string;
  exp: number;
}
