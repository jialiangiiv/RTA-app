import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { QualitativeCode } from "../models/types";
import { affinityNodesService } from "./affinityNodesService";

/** Codes are scoped per-Codebook, not per-Interview-Question or per-Project — a single code is
 *  meant to be applied across however many Interview Questions it legitimately shows up under
 *  (see CodedExcerpt.interview_question_id for where a *specific application* of a code is
 *  IQ-scoped). Soft-deleted codes don't hold their name — a new code (or a restore) can reuse it. */
function assertUniqueLabel(codebookId: string, label: string, excludeId?: string): void {
  const normalized = label.trim().toLowerCase();
  const rows = db
    .prepare(
      `SELECT id FROM qualitative_codes
       WHERE codebook_id = ? AND LOWER(TRIM(label)) = ? AND deleted_at IS NULL`
    )
    .all(codebookId, normalized) as { id: string }[];
  if (rows.some((row) => row.id !== excludeId)) {
    throw new Error(`A code named "${label.trim()}" already exists in this codebook.`);
  }
}

/** Bypasses the deleted_at filter — for trash management (restore/purge/merge) only. */
function getAny(id: string): QualitativeCode | undefined {
  return db.prepare("SELECT * FROM qualitative_codes WHERE id = ?").get(id) as QualitativeCode | undefined;
}

export const qualitativeCodesService = {
  listByCodebook(codebookId: string): QualitativeCode[] {
    return db
      .prepare("SELECT * FROM qualitative_codes WHERE codebook_id = ? AND deleted_at IS NULL")
      .all(codebookId) as QualitativeCode[];
  },

  get(id: string): QualitativeCode | undefined {
    return db
      .prepare("SELECT * FROM qualitative_codes WHERE id = ? AND deleted_at IS NULL")
      .get(id) as QualitativeCode | undefined;
  },

  listTrashedByCodebook(codebookId: string): QualitativeCode[] {
    return db
      .prepare(
        "SELECT * FROM qualitative_codes WHERE codebook_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC"
      )
      .all(codebookId) as QualitativeCode[];
  },

  create(input: {
    codebook_id: string;
    interview_question_id?: string | null;
    label: string;
    description: string;
    theme?: string | null;
    example_quote?: string | null;
    color?: string | null;
  }): QualitativeCode {
    const interviewQuestionId = input.interview_question_id ?? null;
    assertUniqueLabel(input.codebook_id, input.label);
    const qCode: QualitativeCode = {
      id: newId(),
      codebook_id: input.codebook_id,
      interview_question_id: interviewQuestionId,
      label: input.label,
      description: input.description,
      theme: input.theme ?? null,
      example_quote: input.example_quote ?? null,
      color: input.color ?? null,
      created_at: nowIso(),
      deleted_at: null,
    };
    db.prepare(
      `INSERT INTO qualitative_codes (id, codebook_id, interview_question_id, label, description, theme, example_quote, color, created_at, deleted_at)
       VALUES (@id, @codebook_id, @interview_question_id, @label, @description, @theme, @example_quote, @color, @created_at, @deleted_at)`
    ).run(qCode);
    return qCode;
  },

  /** Idempotent variant of create() for user-facing "create a code" actions (inline-while-
   *  highlighting, and the Codes tab's Add Code form): if a code with this label already exists
   *  in the codebook, returns it instead of erroring, so the caller can apply/reuse it rather than
   *  failing or fragmenting the codebook with a near-duplicate. Internal service-to-service callers
   *  (clone/import/merge) call create() directly and keep its throw-on-duplicate contract, since
   *  they already do their own existing-code matching beforehand. */
  createOrGet(input: {
    codebook_id: string;
    interview_question_id?: string | null;
    label: string;
    description: string;
    theme?: string | null;
    example_quote?: string | null;
    color?: string | null;
  }): { code: QualitativeCode; reused: boolean } {
    const normalized = input.label.trim().toLowerCase();
    const existing = db
      .prepare(
        `SELECT * FROM qualitative_codes WHERE codebook_id = ? AND LOWER(TRIM(label)) = ? AND deleted_at IS NULL`
      )
      .get(input.codebook_id, normalized) as QualitativeCode | undefined;
    if (existing) return { code: existing, reused: true };
    return { code: this.create(input), reused: false };
  },

  update(
    id: string,
    updates: Partial<
      Pick<QualitativeCode, "interview_question_id" | "label" | "description" | "theme" | "example_quote" | "color">
    >
  ): QualitativeCode | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    if (updates.label && updates.label.trim().toLowerCase() !== existing.label.trim().toLowerCase()) {
      assertUniqueLabel(existing.codebook_id, updated.label, id);
    }
    db.prepare(
      `UPDATE qualitative_codes SET interview_question_id = @interview_question_id, label = @label,
       description = @description, theme = @theme, example_quote = @example_quote, color = @color WHERE id = @id`
    ).run(updated);
    return updated;
  },

  /** Soft-delete: the code (and, transitively, its highlights) disappear from every normal read
   *  path but remain recoverable via restore() until purge()/purgeAllTrashed() removes them for good. */
  remove(id: string): void {
    const existing = getAny(id);
    if (!existing || existing.deleted_at) return;
    db.prepare("UPDATE qualitative_codes SET deleted_at = ? WHERE id = ?").run(nowIso(), id);
    affinityNodesService.removeByRef("code", id);
  },

  restore(id: string): QualitativeCode | undefined {
    const existing = getAny(id);
    if (!existing || !existing.deleted_at) return undefined;
    // Guard against a name collision with a code created (or restored) while this one was trashed.
    assertUniqueLabel(existing.codebook_id, existing.label, id);
    db.prepare("UPDATE qualitative_codes SET deleted_at = NULL WHERE id = ?").run(id);
    return { ...existing, deleted_at: null };
  },

  /** Real, permanent delete — cascades to coded_excerpts via the schema's ON DELETE CASCADE. */
  purge(id: string): void {
    db.prepare("DELETE FROM qualitative_codes WHERE id = ?").run(id);
    affinityNodesService.removeByRef("code", id);
  },

  purgeAllTrashed(codebookId: string): number {
    const rows = db
      .prepare("SELECT id FROM qualitative_codes WHERE codebook_id = ? AND deleted_at IS NOT NULL")
      .all(codebookId) as { id: string }[];
    const purgeMany = db.transaction((ids: string[]) => {
      for (const id of ids) {
        db.prepare("DELETE FROM qualitative_codes WHERE id = ?").run(id);
        affinityNodesService.removeByRef("code", id);
      }
    });
    purgeMany(rows.map((r) => r.id));
    return rows.length;
  },

  /** Merges one or more source codes into a target: every coded_excerpt pointing at a source is
   *  repointed to the target, then the (now-empty) source codes are permanently removed — merge is
   *  a deliberate, dialog-confirmed action, so sources are terminal rather than trash-recoverable
   *  (a "restore" of an empty, excerpt-less code would be confusing). Sources and target may have
   *  been used under different Interview Questions — that's fine, and expected: each repointed
   *  excerpt keeps its own interview_question_id, so the target simply ends up used under the
   *  union of every IQ its sources were used under. */
  merge(input: { sourceIds: string[]; targetId: string; label?: string; description?: string }): QualitativeCode {
    const doMerge = db.transaction((): QualitativeCode => {
      const target = getAny(input.targetId);
      if (!target || target.deleted_at) throw new Error("Target code not found.");

      const sourceIds = [...new Set(input.sourceIds)].filter((id) => id !== input.targetId);
      if (sourceIds.length === 0) throw new Error("At least one distinct source code is required.");

      const sources = sourceIds.map((id) => {
        const source = getAny(id);
        if (!source || source.deleted_at) throw new Error(`Source code ${id} not found.`);
        if (source.codebook_id !== target.codebook_id) {
          throw new Error("Cannot merge codes from different codebooks.");
        }
        return source;
      });

      const repoint = db.prepare("UPDATE coded_excerpts SET qualitative_code_id = ? WHERE qualitative_code_id = ?");
      for (const source of sources) repoint.run(target.id, source.id);

      for (const source of sources) {
        db.prepare("DELETE FROM qualitative_codes WHERE id = ?").run(source.id);
        affinityNodesService.removeByRef("code", source.id);
      }

      const updates: Partial<Pick<QualitativeCode, "label" | "description">> = {};
      if (input.label && input.label.trim()) updates.label = input.label.trim();
      if (input.description && input.description.trim()) updates.description = input.description.trim();
      if (Object.keys(updates).length > 0) {
        const updated = this.update(target.id, updates);
        if (updated) return updated;
      }
      return target;
    });
    return doMerge();
  },
};
