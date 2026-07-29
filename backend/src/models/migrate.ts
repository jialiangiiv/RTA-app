import fs from "node:fs";
import path from "node:path";
import { db } from "../core/db";
import { logger } from "../core/logger";

/**
 * CREATE TABLE IF NOT EXISTS in schema.sql only covers brand-new databases.
 * Columns added to an already-created table need an explicit, idempotent
 * ALTER TABLE here so existing local .sqlite files pick them up too.
 */
function addColumnIfMissing(table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    logger.info("migrate.column_added", { table, column });
  }
}

function migrate() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  addColumnIfMissing("projects", "is_comparison_source", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("codebooks", "kind", "TEXT NOT NULL DEFAULT 'own'");
  addColumnIfMissing("projects", "highlight_color", "TEXT NOT NULL DEFAULT '#b0461d'");
  const addedSortOrder = !((db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]).some(
    (col) => col.name === "sort_order"
  ));
  addColumnIfMissing("projects", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  if (addedSortOrder) {
    // Backfill so pre-existing rows keep their prior (created_at) order instead of collapsing to 0.
    db.exec(`
      UPDATE projects SET sort_order = (
        SELECT COUNT(*) FROM projects p2 WHERE p2.created_at < projects.created_at
      )
    `);
  }
  const addedActiveCodebook = !((db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]).some(
    (col) => col.name === "active_codebook_id"
  ));
  addColumnIfMissing("projects", "active_codebook_id", "TEXT REFERENCES codebooks(id)");
  if (addedActiveCodebook) {
    // Backfill: point every pre-existing Project at its (first) 'own' Codebook so versioning
    // has a starting point instead of every project appearing to have no active Codebook.
    db.exec(`
      UPDATE projects SET active_codebook_id = (
        SELECT id FROM codebooks WHERE codebooks.project_id = projects.id AND codebooks.kind = 'own'
        ORDER BY created_at ASC LIMIT 1
      ) WHERE active_codebook_id IS NULL
    `);
  }
  // One-time cleanup for the Affinity Map's 'rq_lane'/'unsorted' node types, replaced by
  // 'iq_board'/'not_yet_coded'. Guarded on legacy rows actually existing so this only ever fires
  // once per DB — otherwise it would wipe 'code' nodes (and every user-dragged position) on EVERY
  // startup. 'code' nodes are wiped alongside them since they're fully re-derivable from
  // coded_excerpts — affinityNodesService.autoSeed rebuilds them correctly under the new scheme
  // on next board load.
  const hasLegacyAffinityNodes =
    db.prepare("SELECT 1 FROM affinity_nodes WHERE node_type IN ('rq_lane', 'unsorted') LIMIT 1").get() !== undefined;
  if (hasLegacyAffinityNodes) {
    db.exec(`DELETE FROM affinity_nodes WHERE node_type IN ('rq_lane', 'unsorted', 'code')`);
    logger.info("migrate.affinity_nodes_reset", {});
  }

  logger.info("migrate.applied", { schemaPath });
}

migrate();
