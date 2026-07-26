import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("order_items", (t) => {
    t.uuid("id").primary();
    t.uuid("order_id")
      .notNullable()
      .references("id")
      .inTable("orders")
      .onDelete("CASCADE");
    t.uuid("product_id")
      .notNullable()
      .references("id")
      .inTable("products")
      .onDelete("RESTRICT");
    // Snapshot name/price at time of order — products can change name/price
    // (or be deactivated) after the order is placed; the order must keep
    // showing what the customer actually bought and paid.
    t.string("product_name").notNullable();
    t.decimal("price", 10, 2).notNullable();
    t.integer("quantity").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index(["order_id"], "idx_order_items_order_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("order_items");
}
