import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("cart_items", (t) => {
    t.uuid("id").primary();
    t.uuid("customer_id")
      .notNullable()
      .references("id")
      .inTable("customers")
      .onDelete("CASCADE");
    t.uuid("product_id")
      .notNullable()
      .references("id")
      .inTable("products")
      .onDelete("CASCADE");
    t.integer("quantity").notNullable().checkPositive();
    t.timestamp("added_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.unique(["customer_id", "product_id"], {
      indexName: "uq_cart_customer_product",
    });
    t.index(["customer_id"], "idx_cart_items_customer_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cart_items");
}
