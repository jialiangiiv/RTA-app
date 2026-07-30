import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";

export interface ComparisonSessionRecord {
  id: string;
  project_id: string;
  owner_name: string;
  /** The full imported CodebookShareBundle, stored verbatim — backend treats it as opaque JSON. */
  bundle: unknown;
  accepted_code_names: string[];
  edited_by_code_name: Record<string, { label: string; definition: string }>;
  excluded_code_names: string[];
  excluded_right_keys: string[];
  created_at: string;
  updated_at: string;
}

interface Row {
  id: string;
  project_id: string;
  owner_name: string;
  bundle_json: string;
  accepted_code_names_json: string;
  edited_by_code_name_json: string;
  excluded_code_names_json: string;
  excluded_right_keys_json: string;
  created_at: string;
  updated_at: string;
}

function toRecord(row: Row): ComparisonSessionRecord {
  return {
    id: row.id,
    project_id: row.project_id,
    owner_name: row.owner_name,
    bundle: JSON.parse(row.bundle_json),
    accepted_code_names: JSON.parse(row.accepted_code_names_json),
    edited_by_code_name: JSON.parse(row.edited_by_code_name_json),
    excluded_code_names: JSON.parse(row.excluded_code_names_json),
    excluded_right_keys: JSON.parse(row.excluded_right_keys_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const comparisonSessionsService = {
  getByProject(projectId: string): ComparisonSessionRecord | undefined {
    const row = db.prepare("SELECT * FROM comparison_sessions WHERE project_id = ?").get(projectId) as
      | Row
      | undefined;
    return row ? toRecord(row) : undefined;
  },

  /** Upserts the single comparison session for a project — saving again overwrites the prior save. */
  save(input: {
    project_id: string;
    owner_name: string;
    bundle: unknown;
    accepted_code_names: string[];
    edited_by_code_name: Record<string, { label: string; definition: string }>;
    excluded_code_names: string[];
    excluded_right_keys: string[];
  }): ComparisonSessionRecord {
    const existing = db
      .prepare("SELECT id, created_at FROM comparison_sessions WHERE project_id = ?")
      .get(input.project_id) as { id: string; created_at: string } | undefined;
    const now = nowIso();
    const row: Row = {
      id: existing?.id ?? newId(),
      project_id: input.project_id,
      owner_name: input.owner_name,
      bundle_json: JSON.stringify(input.bundle),
      accepted_code_names_json: JSON.stringify(input.accepted_code_names),
      edited_by_code_name_json: JSON.stringify(input.edited_by_code_name),
      excluded_code_names_json: JSON.stringify(input.excluded_code_names),
      excluded_right_keys_json: JSON.stringify(input.excluded_right_keys),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    db.prepare(
      `INSERT INTO comparison_sessions
         (id, project_id, owner_name, bundle_json, accepted_code_names_json, edited_by_code_name_json, excluded_code_names_json, excluded_right_keys_json, created_at, updated_at)
       VALUES (@id, @project_id, @owner_name, @bundle_json, @accepted_code_names_json, @edited_by_code_name_json, @excluded_code_names_json, @excluded_right_keys_json, @created_at, @updated_at)
       ON CONFLICT(project_id) DO UPDATE SET
         owner_name = excluded.owner_name,
         bundle_json = excluded.bundle_json,
         accepted_code_names_json = excluded.accepted_code_names_json,
         edited_by_code_name_json = excluded.edited_by_code_name_json,
         excluded_code_names_json = excluded.excluded_code_names_json,
         excluded_right_keys_json = excluded.excluded_right_keys_json,
         updated_at = excluded.updated_at`
    ).run(row);
    return toRecord(row);
  },

  removeByProject(projectId: string): void {
    db.prepare("DELETE FROM comparison_sessions WHERE project_id = ?").run(projectId);
  },
};
