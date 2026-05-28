import type { Knex } from "knex";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex("admin_users")
    .where({ role: "super_admin" })
    .first();
  if (existing) {
    console.log("[seed] Super Admin already exists — skipping");
    return;
  }

  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password)
    throw new Error("SUPER_ADMIN_PASSWORD env var is required to run seed");

  const password_hash = await bcrypt.hash(password, 12);

  await knex("admin_users").insert({
    id: uuidv4(),
    username: process.env.SUPER_ADMIN_USERNAME ?? "superadmin",
    email: process.env.SUPER_ADMIN_EMAIL,
    password_hash,
    role: "super_admin",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log("[seed] Super Admin created");
}
