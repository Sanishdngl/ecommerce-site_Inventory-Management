import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("admin_users", (t) => {
    t.uuid("id").primary();
    t.string("username").notNullable().unique();
    t.string("email").notNullable().unique();
    t.string("password_hash").notNullable();
    t.enu("role", ["super_admin", "maintainer", "reporter"]).notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("admin_users");
}
