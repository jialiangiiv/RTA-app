import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { AffinityNode, AffinityNodeType } from "../models/types";
import { researchQuestionsService } from "./researchQuestionsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { projectsService } from "./projectsService";

/** Only these node_types are user-creatable via create(); 'code'/'iq_board'/'not_yet_coded' are
 *  system-managed and only ever produced by autoSeed(). */
const CREATABLE_TYPES: AffinityNodeType[] = ["section", "theme", "note"];
const SYSTEM_TYPES: AffinityNodeType[] = ["code", "iq_board", "not_yet_coded"];

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

  /** Users delete the underlying q_code/IQ to remove a 'code'/'iq_board' node — this only handles
   *  user-created 'section'/'theme'/'note' rows. */
  remove(id: string): void {
    const existing = this.get(id);
    if (!existing) return;
    if (SYSTEM_TYPES.includes(existing.node_type)) {
      throw new Error(`Cannot delete a system-managed "${existing.node_type}" node directly.`);
    }
    db.prepare("DELETE FROM affinity_nodes WHERE id = ?").run(id);
  },

  /** Called from qualitativeCodesService/interviewQuestionsService when the referenced row is
   *  deleted, since ref_id isn't a real FK (SQLite can't conditionally FK by node_type). */
  removeByRef(nodeType: "code" | "iq_board", refId: string): void {
    db.prepare("DELETE FROM affinity_nodes WHERE node_type = ? AND ref_id = ?").run(nodeType, refId);
  },

  /**
   * Reconciles the board against live data — not just "add missing" like the old rq_lane/unsorted
   * scheme, but also removes stale rows, because code placement now reflects a live fact (which IQ
   * a code is actually coded under) rather than a one-time snapshot the user then owns:
   *   1. One 'not_yet_coded' bin per project (create if missing).
   *   2. One 'iq_board' node per Interview Question (create if missing; delete any whose IQ no
   *      longer exists — handles an IQ's Research Question being deleted, which cascades the IQ
   *      away at the DB level without going through interviewQuestionsService.remove()).
   *   3. For each q_code in the active Codebook: a 'code' node under every IQ it currently has a
   *      coded_excerpt under (duplicated across boards if coded under several), or exactly one
   *      node under 'not_yet_coded' if it has none — adding/removing nodes to match reality.
   * Safe to call on every board load: with no data changes since the last call, it's a no-op and
   * never disturbs positions the user has already dragged.
   */
  autoSeed(projectId: string): AffinityNode[] {
    db.transaction(() => {
      let notYetCoded = db
        .prepare("SELECT * FROM affinity_nodes WHERE project_id = ? AND node_type = 'not_yet_coded'")
        .get(projectId) as AffinityNode | undefined;
      if (!notYetCoded) {
        const now = nowIso();
        notYetCoded = {
          id: newId(),
          project_id: projectId,
          node_type: "not_yet_coded",
          parent_id: null,
          ref_id: null,
          label: "Not Yet Coded",
          body: null,
          pos_x: 40,
          pos_y: 40,
          width: 320,
          height: 600,
          font_size: null,
          color: null,
          z_index: 0,
          created_at: now,
          updated_at: now,
        };
        insertNode(notYetCoded);
      }

      // Column-per-RQ, IQ boards stacked vertically within their RQ's column.
      const rqs = researchQuestionsService.listByProject(projectId);
      const iqBoardIdByIqId = new Map<string, string>();
      // pos_x/pos_y are absolute canvas coordinates everywhere in this table (see
      // handleNodeDragStop in AffinityBoardView.tsx, which always persists absolute coordinates,
      // and the render math `n.pos_x - parent.pos_x`) — so code-node slots below must be offset
      // by their parent's own absolute position, not just the bare PAD/CELL_W/CELL_H offset.
      const iqBoardPosById = new Map<string, { pos_x: number; pos_y: number }>();
      const liveIqIds = new Set<string>();
      rqs.forEach((rq, rqIndex) => {
        const iqs = interviewQuestionsService.listByResearchQuestion(rq.id);
        iqs.forEach((iq, iqIndex) => {
          liveIqIds.add(iq.id);
          const existing = db
            .prepare("SELECT id, pos_x, pos_y FROM affinity_nodes WHERE project_id = ? AND node_type = 'iq_board' AND ref_id = ?")
            .get(projectId, iq.id) as { id: string; pos_x: number; pos_y: number } | undefined;
          if (existing) {
            iqBoardIdByIqId.set(iq.id, existing.id);
            iqBoardPosById.set(existing.id, { pos_x: existing.pos_x, pos_y: existing.pos_y });
            return;
          }
          const now = nowIso();
          const id = newId();
          const pos_x = 420 + rqIndex * 420;
          const pos_y = 40 + iqIndex * 660;
          insertNode({
            id,
            project_id: projectId,
            node_type: "iq_board",
            parent_id: null,
            ref_id: iq.id,
            label: null,
            body: null,
            pos_x,
            pos_y,
            width: 380,
            height: 600,
            font_size: null,
            color: null,
            z_index: 0,
            created_at: now,
            updated_at: now,
          });
          iqBoardIdByIqId.set(iq.id, id);
          iqBoardPosById.set(id, { pos_x, pos_y });
        });
      });

      // Drop iq_board nodes for IQs that no longer exist (e.g. their RQ was deleted, which
      // cascades the IQ away at the DB level without going through interviewQuestionsService).
      const staleIqBoards = db
        .prepare("SELECT id, ref_id FROM affinity_nodes WHERE project_id = ? AND node_type = 'iq_board'")
        .all(projectId) as { id: string; ref_id: string }[];
      for (const board of staleIqBoards) {
        if (!liveIqIds.has(board.ref_id)) {
          db.prepare("DELETE FROM affinity_nodes WHERE id = ?").run(board.id);
          iqBoardIdByIqId.delete(board.ref_id);
        }
      }

      const project = projectsService.get(projectId);
      if (project?.active_codebook_id) {
        const codes = qualitativeCodesService.listByCodebook(project.active_codebook_id);
        const COLS = 2;
        const CELL_W = 150;
        const CELL_H = 70;
        const PAD = 16;
        const countByParent = new Map<string, number>();

        // A code node dragged into a Theme/Section within its IQ board is still "covered" for
        // that IQ (see AffinityBoardView's ALLOWED_PARENTS: code -> theme -> section -> iq_board),
        // so checking only direct parent_id === boardId (as this used to) fails to recognize it and
        // creates a duplicate. Walk each existing node's full parent chain to find its real
        // iq_board ancestor, however deep it's nested.
        const allNodesById = new Map(
          (db.prepare("SELECT * FROM affinity_nodes WHERE project_id = ?").all(projectId) as AffinityNode[]).map(
            (n) => [n.id, n]
          )
        );
        const iqIdByBoardId = new Map<string, string>();
        for (const [iqId, boardId] of iqBoardIdByIqId) iqIdByBoardId.set(boardId, iqId);
        function iqIdForNode(node: AffinityNode): string | undefined {
          let current: AffinityNode | undefined = node;
          while (current) {
            const iqId = iqIdByBoardId.get(current.id);
            if (iqId) return iqId;
            current = current.parent_id ? allNodesById.get(current.parent_id) : undefined;
          }
          return undefined;
        }

        /** Returns the next free grid slot's position, in ABSOLUTE canvas coordinates (parent's
         *  own absolute position plus a small local PAD/CELL_W/CELL_H offset) — pos_x/pos_y must
         *  be absolute here, matching every other node type, since rendering derives on-screen
         *  position as `n.pos_x - parent.pos_x`. */
        function nextSlot(parentId: string, parentPos: { pos_x: number; pos_y: number }): { pos_x: number; pos_y: number } {
          const count = countByParent.get(parentId) ?? 0;
          countByParent.set(parentId, count + 1);
          return {
            pos_x: parentPos.pos_x + PAD + (count % COLS) * CELL_W,
            pos_y: parentPos.pos_y + PAD + Math.floor(count / COLS) * CELL_H,
          };
        }

        for (const code of codes) {
          const excerpts = codedExcerptsService.listByQualitativeCode(code.id);
          const currentIqIds = new Set(excerpts.map((e) => e.interview_question_id));

          const existingNodes = db
            .prepare("SELECT * FROM affinity_nodes WHERE project_id = ? AND node_type = 'code' AND ref_id = ?")
            .all(projectId, code.id) as AffinityNode[];

          if (currentIqIds.size === 0) {
            // Not coded anywhere: ensure exactly one instance under not_yet_coded; drop any
            // instance left over under a real iq_board (its excerpts were deleted since last seed).
            const hasNotYetCoded = existingNodes.some((n) => n.parent_id === notYetCoded!.id);
            for (const n of existingNodes) {
              if (n.parent_id !== notYetCoded!.id) db.prepare("DELETE FROM affinity_nodes WHERE id = ?").run(n.id);
            }
            if (!hasNotYetCoded) {
              const now = nowIso();
              const slot = nextSlot(notYetCoded!.id, { pos_x: notYetCoded!.pos_x, pos_y: notYetCoded!.pos_y });
              insertNode({
                id: newId(),
                project_id: projectId,
                node_type: "code",
                parent_id: notYetCoded!.id,
                ref_id: code.id,
                label: null,
                body: null,
                pos_x: slot.pos_x,
                pos_y: slot.pos_y,
                width: null,
                height: null,
                font_size: null,
                color: null,
                z_index: 0,
                created_at: now,
                updated_at: now,
              });
            }
            continue;
          }

          // Coded somewhere: drop the not_yet_coded instance (no longer accurate) and any instance
          // whose IQ no longer has an excerpt for this code; add any missing IQ's instance.
          const existingIqIdByNodeId = new Map<string, string>();
          for (const n of existingNodes) {
            const iqId = iqIdForNode(n);
            if (iqId) existingIqIdByNodeId.set(n.id, iqId);
          }
          for (const n of existingNodes) {
            const iqId = existingIqIdByNodeId.get(n.id);
            if (n.parent_id === notYetCoded!.id || (iqId && !currentIqIds.has(iqId))) {
              db.prepare("DELETE FROM affinity_nodes WHERE id = ?").run(n.id);
            }
          }
          const coveredIqIds = new Set(existingIqIdByNodeId.values());
          for (const iqId of currentIqIds) {
            if (coveredIqIds.has(iqId)) continue;
            const boardId = iqBoardIdByIqId.get(iqId);
            if (!boardId) continue;
            const boardPos = iqBoardPosById.get(boardId);
            if (!boardPos) continue;
            const now = nowIso();
            const slot = nextSlot(boardId, boardPos);
            insertNode({
              id: newId(),
              project_id: projectId,
              node_type: "code",
              parent_id: boardId,
              ref_id: code.id,
              label: null,
              body: null,
              pos_x: slot.pos_x,
              pos_y: slot.pos_y,
              width: null,
              height: null,
              font_size: null,
              color: null,
              z_index: 0,
              created_at: now,
              updated_at: now,
            });
          }
        }
      }
    })();

    return this.listByProject(projectId);
  },
};
