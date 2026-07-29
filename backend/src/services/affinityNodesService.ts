import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { AffinityNode, AffinityNodeType } from "../models/types";
import { researchQuestionsService } from "./researchQuestionsService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { projectsService } from "./projectsService";

/** Only these node_types are user-creatable via create(); 'code'/'rq_lane'/'unsorted' are
 *  system-managed and only ever produced by autoSeed(). */
const CREATABLE_TYPES: AffinityNodeType[] = ["section", "theme", "note"];
const SYSTEM_TYPES: AffinityNodeType[] = ["code", "rq_lane", "unsorted"];

function insertNode(node: AffinityNode): void {
  db.prepare(
    `INSERT INTO affinity_nodes
       (id, project_id, node_type, parent_id, ref_id, label, body, pos_x, pos_y, width, height, font_size, color, z_index, created_at, updated_at)
     VALUES
       (@id, @project_id, @node_type, @parent_id, @ref_id, @label, @body, @pos_x, @pos_y, @width, @height, @font_size, @color, @z_index, @created_at, @updated_at)`
  ).run(node);
}

export const affinityNodesService = {
  listByProject(projectId: string): AffinityNode[] {
    return db.prepare("SELECT * FROM affinity_nodes WHERE project_id = ?").all(projectId) as AffinityNode[];
  },

  get(id: string): AffinityNode | undefined {
    return db.prepare("SELECT * FROM affinity_nodes WHERE id = ?").get(id) as AffinityNode | undefined;
  },

  create(input: {
    project_id: string;
    node_type: "section" | "theme" | "note";
    parent_id?: string | null;
    label?: string | null;
    body?: string | null;
    pos_x: number;
    pos_y: number;
    width?: number | null;
    height?: number | null;
    font_size?: number | null;
    color?: string | null;
  }): AffinityNode {
    if (!CREATABLE_TYPES.includes(input.node_type)) {
      throw new Error(`node_type must be one of: ${CREATABLE_TYPES.join(", ")}`);
    }
    const now = nowIso();
    const node: AffinityNode = {
      id: newId(),
      project_id: input.project_id,
      node_type: input.node_type,
      parent_id: input.parent_id ?? null,
      ref_id: null,
      label: input.label ?? null,
      body: input.body ?? null,
      pos_x: input.pos_x,
      pos_y: input.pos_y,
      width: input.width ?? null,
      height: input.height ?? null,
      font_size: input.font_size ?? null,
      color: input.color ?? null,
      z_index: 0,
      created_at: now,
      updated_at: now,
    };
    insertNode(node);
    return node;
  },

  update(
    id: string,
    updates: Partial<
      Pick<
        AffinityNode,
        "parent_id" | "label" | "body" | "pos_x" | "pos_y" | "width" | "height" | "font_size" | "color" | "z_index"
      >
    >
  ): AffinityNode | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: AffinityNode = { ...existing, ...updates, updated_at: nowIso() };
    db.prepare(
      `UPDATE affinity_nodes SET parent_id = @parent_id, label = @label, body = @body, pos_x = @pos_x, pos_y = @pos_y,
       width = @width, height = @height, font_size = @font_size, color = @color, z_index = @z_index, updated_at = @updated_at
       WHERE id = @id`
    ).run(updated);
    return updated;
  },

  /** Users delete the underlying q_code/RQ to remove a 'code'/'rq_lane' node — this only handles
   *  user-created 'section'/'theme'/'note' rows. */
  remove(id: string): void {
    const existing = this.get(id);
    if (!existing) return;
    if (SYSTEM_TYPES.includes(existing.node_type)) {
      throw new Error(`Cannot delete a system-managed "${existing.node_type}" node directly.`);
    }
    db.prepare("DELETE FROM affinity_nodes WHERE id = ?").run(id);
  },

  /** Called from qualitativeCodesService/researchQuestionsService when the referenced row is deleted,
   *  since ref_id isn't a real FK (SQLite can't conditionally FK by node_type). */
  removeByRef(nodeType: "code" | "rq_lane", refId: string): void {
    db.prepare("DELETE FROM affinity_nodes WHERE node_type = ? AND ref_id = ?").run(nodeType, refId);
  },

  /**
   * Idempotent: ensures one 'unsorted' bin, one 'rq_lane' node per Research Question, and one
   * 'code' node (parented to 'unsorted') per q_code in the active Codebook exist for this Project —
   * only ever adding missing rows, so calling this on every board load is safe and never disturbs
   * positions the user has already dragged.
   */
  autoSeed(projectId: string): AffinityNode[] {
    db.transaction(() => {
      let unsorted = db
        .prepare("SELECT * FROM affinity_nodes WHERE project_id = ? AND node_type = 'unsorted'")
        .get(projectId) as AffinityNode | undefined;
      if (!unsorted) {
        const now = nowIso();
        unsorted = {
          id: newId(),
          project_id: projectId,
          node_type: "unsorted",
          parent_id: null,
          ref_id: null,
          label: "Unsorted",
          body: null,
          pos_x: 40,
          pos_y: 40,
          width: 320,
          height: 2000,
          font_size: null,
          color: null,
          z_index: 0,
          created_at: now,
          updated_at: now,
        };
        insertNode(unsorted);
      }

      const rqs = researchQuestionsService.listByProject(projectId);
      rqs.forEach((rq, i) => {
        const exists = db
          .prepare("SELECT id FROM affinity_nodes WHERE project_id = ? AND node_type = 'rq_lane' AND ref_id = ?")
          .get(projectId, rq.id);
        if (exists) return;
        const now = nowIso();
        insertNode({
          id: newId(),
          project_id: projectId,
          node_type: "rq_lane",
          parent_id: null,
          ref_id: rq.id,
          label: null,
          body: null,
          pos_x: 420 + i * 900,
          pos_y: 40,
          width: 850,
          height: 600,
          font_size: null,
          color: null,
          z_index: 0,
          created_at: now,
          updated_at: now,
        });
      });

      const project = projectsService.get(projectId);
      if (project?.active_codebook_id) {
        const codes = qualitativeCodesService.listByCodebook(project.active_codebook_id);
        const COLS = 2;
        const CELL_W = 150;
        const CELL_H = 70;
        const PAD = 16;
        let seededCount = 0;
        for (const code of codes) {
          const exists = db
            .prepare("SELECT id FROM affinity_nodes WHERE project_id = ? AND node_type = 'code' AND ref_id = ?")
            .get(projectId, code.id);
          if (exists) continue;
          const col = seededCount % COLS;
          const row = Math.floor(seededCount / COLS);
          const now = nowIso();
          insertNode({
            id: newId(),
            project_id: projectId,
            node_type: "code",
            parent_id: unsorted.id,
            ref_id: code.id,
            label: null,
            body: null,
            pos_x: PAD + col * CELL_W,
            pos_y: PAD + row * CELL_H,
            width: null,
            height: null,
            font_size: null,
            color: null,
            z_index: 0,
            created_at: now,
            updated_at: now,
          });
          seededCount++;
        }
      }
    })();

    return this.listByProject(projectId);
  },
};
