import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("audit_logs", (t) => {
    t.uuid("id").primary();
    t.enu("entity_type", ["admin_user", "product", "category"]).notNullable();
    t.uuid("entity_id").notNullable();
    t.enu("action", ["create", "update", "delete"]).notNullable();
    t.uuid("performed_by")
      .notNullable()
      .references("id")
      .inTable("admin_users")
      .onDelete("RESTRICT");
    t.json("metadata").nullable();
    t.string("ip_address").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index(["entity_type", "entity_id"], "idx_audit_logs_entity");
    t.index(["performed_by"], "idx_audit_logs_performed_by");
    t.index(["created_at"], "idx_audit_logs_created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("audit_logs");
}
