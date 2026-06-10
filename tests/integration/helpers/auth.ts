import request from "supertest";
import app from "../../../gateway/src/app";

export interface AdminTokens {
  token: string;
  userId: string;
}

export interface CustomerTokens {
  token: string;
  customerId: string;
}

export async function loginAsSuperAdmin(): Promise<AdminTokens> {
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({
      username: process.env.SUPER_ADMIN_USERNAME ?? "superadmin",
      password: process.env.SUPER_ADMIN_PASSWORD,
    });

  if (res.status !== 200) {
    throw new Error(`Super admin login failed: ${JSON.stringify(res.body)}`);
  }

  return { token: res.body.token, userId: res.body.user.id };
}

export function adminAuthHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function registerAndLoginCustomer(
  email = `test_${Date.now()}@example.com`,
  password = "testpassword123"
): Promise<CustomerTokens> {
  const res = await request(app)
    .post("/api/customer/auth/register")
    .send({ email, password, first_name: "Test", last_name: "User" });

  if (res.status !== 201) {
    throw new Error(`Customer register failed: ${JSON.stringify(res.body)}`);
  }

  return { token: res.body.token, customerId: res.body.customer.id };
}

export function customerAuthHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
