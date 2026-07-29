import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { AffinityNodeTag, Tag } from "../models/types";

/** Tag names are scoped per-Project (custom labels like "status"/"source"/"importance" — see
 *  PROJECT.md Affinity Map section), mirroring how q_code labels are scoped per-Codebook. */
function assertUniqueName(projectId: string, name: string, excludeId?: string): void {
  const normalized = name.trim().toLowerCase();
  const rows = db
    .prepare("SELECT id FROM tags WHERE project_id = ? AND LOWER(TRIM(name)) = ?")
    .all(projectId, normalized) as { id: string }[];
  if (rows.some((row) => row.id !== excludeId)) {
    throw new Error(`A tag named "${name.trim()}" already exists in this project.`);
  }
}

export const tagsService = {
  listByProject(projectId: string): Tag[] {
    return db.prepare("SELECT * FROM tags WHERE project_id = ?").all(projectId) as Tag[];
  },

  get(id: string): Tag | undefined {
    return db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as Tag | undefined;
  },

  create(input: { project_id: string; name: string; color?: string | null }): Tag {
    assertUniqueName(input.project_id, input.name);
    const tag: Tag = {
      id: newId(),
      project_id: input.project_id,
      name: input.name,
      color: input.color ?? null,
      created_at: nowIso(),
    };
    db.prepare("INSERT INTO tags (id, project_id, name, color, created_at) VALUES (@id, @project_id, @name, @color, @created_at)").run(
      tag
    );
    return tag;
  },

  update(id: string, updates: Partial<Pick<Tag, "name" | "color">>): Tag | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    if (updates.name && updates.name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
      assertUniqueName(existing.project_id, updates.name, id);
    }
    const updated = { ...existing, ...updates };
    db.prepare("UPDATE tags SET name = @name, color = @color WHERE id = @id").run(updated);
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  },

  /** Bulk — every {affinity_node_id, tag_id} pair for the project in one query, so the board can
   *  render up to ~1000 nodes' tag chips without an N+1 request per node. */
  listAssignments(projectId: string): AffinityNodeTag[] {
    return db
      .prepare(
        `SELECT ant.affinity_node_id, ant.tag_id FROM affinity_node_tags ant
         JOIN tags t ON t.id = ant.tag_id
         WHERE t.project_id = ?`
      )
      .all(projectId) as AffinityNodeTag[];
  },

  assign(tagId: string, affinityNodeId: string): void {
    db.prepare("INSERT OR IGNORE INTO affinity_node_tags (affinity_node_id, tag_id) VALUES (?, ?)").run(
      affinityNodeId,
      tagId
    );
  },

  unassign(tagId: string, affinityNodeId: string): void {
    db.prepare("DELETE FROM affinity_node_tags WHERE affinity_node_id = ? AND tag_id = ?").run(affinityNodeId, tagId);
  },
};
