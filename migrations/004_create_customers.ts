import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("customers", (t) => {
    t.uuid("id").primary();
    t.string("email").notNullable().unique();
    t.string("password_hash").nullable();
    t.string("oauth_provider").nullable();
    t.string("oauth_id").nullable();
    t.string("first_name").notNullable();
    t.string("last_name").notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["oauth_provider", "oauth_id"], "idx_customers_oauth");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("customers");
}
