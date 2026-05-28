import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("products", (t) => {
    t.uuid("id").primary();
    t.uuid("category_id")
      .notNullable()
      .references("id")
      .inTable("categories")
      .onDelete("RESTRICT");
    t.string("name").notNullable();
    t.text("description").nullable();
    t.decimal("price", 10, 2).notNullable();
    t.integer("stock_quantity").notNullable().defaultTo(0);
    t.string("thumbnail_url").nullable();
    t.string("list_image_url").nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["category_id"], "idx_products_category_id");
    t.index(["is_active"], "idx_products_is_active");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("products");
}
