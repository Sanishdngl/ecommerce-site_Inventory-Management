import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("orders", (t) => {
    t.uuid("id").primary();
    t.uuid("customer_id")
      .notNullable()
      .references("id")
      .inTable("customers")
      .onDelete("RESTRICT");
    t.enu("status", ["pending", "confirmed", "cancelled"])
      .notNullable()
      .defaultTo("pending");
    t.decimal("total_amount", 10, 2).notNullable();
    // Set when ReserveStockForOrder returns success:false — surfaced to the
    // customer so "why was my order cancelled" isn't a silent mystery.
    t.string("cancellation_reason", 255).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["customer_id"], "idx_orders_customer_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("orders");
}
