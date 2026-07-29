import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { QualitativeCode } from "../models/types";
import { affinityNodesService } from "./affinityNodesService";

/** Codes are scoped per-Codebook, not per-Project — a comparison Codebook is expected to share
 *  names with the user's own codes (that's the point of comparing), so uniqueness only applies
 *  within a single Codebook. */
function assertUniqueLabel(codebookId: string, label: string, excludeId?: string): void {
  const normalized = label.trim().toLowerCase();
  const rows = db
    .prepare("SELECT id FROM qualitative_codes WHERE codebook_id = ? AND LOWER(TRIM(label)) = ?")
    .all(codebookId, normalized) as { id: string }[];
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
    label: string;
    description: string;
    theme?: string | null;
    example_quote?: string | null;
    color?: string | null;
  }): QualitativeCode {
    assertUniqueLabel(input.codebook_id, input.label);
    const qCode: QualitativeCode = {
      id: newId(),
      codebook_id: input.codebook_id,
      label: input.label,
      description: input.description,
      theme: input.theme ?? null,
      example_quote: input.example_quote ?? null,
      color: input.color ?? null,
      created_at: nowIso(),
    };
    db.prepare(
      `INSERT INTO qualitative_codes (id, codebook_id, label, description, theme, example_quote, color, created_at)
       VALUES (@id, @codebook_id, @label, @description, @theme, @example_quote, @color, @created_at)`
    ).run(qCode);
    return qCode;
  },

  update(
    id: string,
    updates: Partial<Pick<QualitativeCode, "label" | "description" | "theme" | "example_quote" | "color">>
  ): QualitativeCode | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    if (updates.label && updates.label.trim().toLowerCase() !== existing.label.trim().toLowerCase()) {
      assertUniqueLabel(existing.codebook_id, updates.label, id);
    }
    const updated = { ...existing, ...updates };
    db.prepare(
      `UPDATE qualitative_codes SET label = @label, description = @description, theme = @theme,
       example_quote = @example_quote, color = @color WHERE id = @id`
    ).run(updated);
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM qualitative_codes WHERE id = ?").run(id);
    affinityNodesService.removeByRef("code", id);
  },
};
