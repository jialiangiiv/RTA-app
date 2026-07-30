import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { QualitativeCode } from "../models/types";
import { affinityNodesService } from "./affinityNodesService";

/** Codes are scoped per-Codebook AND per-Interview-Question, not per-Project — a comparison
 *  Codebook is expected to share names with the user's own codes (that's the point of comparing),
 *  and the same code name may legitimately exist under two different Interview Questions (e.g. one
 *  per-IQ import creates its own "Motivation" distinct from another IQ's "Motivation"). Codes with
 *  no Interview Question (interview_question_id = NULL, e.g. all manually created codes) are
 *  likewise only unique amongst each other, via SQLite's null-safe `IS` comparison. */
function assertUniqueLabel(
  codebookId: string,
  interviewQuestionId: string | null,
  label: string,
  excludeId?: string
): void {
  const normalized = label.trim().toLowerCase();
  const rows = db
    .prepare(
      "SELECT id FROM qualitative_codes WHERE codebook_id = ? AND interview_question_id IS ? AND LOWER(TRIM(label)) = ?"
    )
    .all(codebookId, interviewQuestionId, normalized) as { id: string }[];
  if (rows.some((row) => row.id !== excludeId)) {
    throw new Error(`A code named "${label.trim()}" already exists in this codebook.`);
  }
}

export const qualitativeCodesService = {
  listByCodebook(codebookId: string): QualitativeCode[] {
    return db
      .prepare("SELECT * FROM qualitative_codes WHERE codebook_id = ?")
      .all(codebookId) as QualitativeCode[];
  },

  get(id: string): QualitativeCode | undefined {
    return db.prepare("SELECT * FROM qualitative_codes WHERE id = ?").get(id) as QualitativeCode | undefined;
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
    assertUniqueLabel(input.codebook_id, interviewQuestionId, input.label);
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
    };
    db.prepare(
      `INSERT INTO qualitative_codes (id, codebook_id, interview_question_id, label, description, theme, example_quote, color, created_at)
       VALUES (@id, @codebook_id, @interview_question_id, @label, @description, @theme, @example_quote, @color, @created_at)`
    ).run(qCode);
    return qCode;
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
    if (
      (updates.label && updates.label.trim().toLowerCase() !== existing.label.trim().toLowerCase()) ||
      (Object.prototype.hasOwnProperty.call(updates, "interview_question_id") &&
        updates.interview_question_id !== existing.interview_question_id)
    ) {
      assertUniqueLabel(existing.codebook_id, updated.interview_question_id, updated.label, id);
    }
    db.prepare(
      `UPDATE qualitative_codes SET interview_question_id = @interview_question_id, label = @label,
       description = @description, theme = @theme, example_quote = @example_quote, color = @color WHERE id = @id`
    ).run(updated);
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM qualitative_codes WHERE id = ?").run(id);
    affinityNodesService.removeByRef("code", id);
  },
};
