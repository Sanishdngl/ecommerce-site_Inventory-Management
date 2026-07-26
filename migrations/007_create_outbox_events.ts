import type { Knex } from "knex";

// Transactional outbox for Kafka/Debezium CDC integration.
// Written inside the SAME transaction as the business write it represents —
// never written to directly by anything outside that transaction, and never
// updated/deleted after insert (append-only; Debezium tails it via binlog).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("outbox_events", (t) => {
    t.uuid("id").primary();
    t.enu("aggregate_type", ["product", "stock", "order"]).notNullable();
    t.uuid("aggregate_id").notNullable();
    t.string("event_type", 50).notNullable(); // e.g. "created" | "updated" | "stock_adjusted" | "placed"
    t.json("payload").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    // Debezium/consumer lookups filter by aggregate; created_at supports
    // ordering/backfill queries during connector setup and debugging.
    t.index(["aggregate_type", "aggregate_id"], "idx_outbox_events_aggregate");
    t.index(["created_at"], "idx_outbox_events_created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("outbox_events");
}
