import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { CodedExcerpt } from "../models/types";

export const codedExcerptsService = {
  listByTranscript(transcriptId: string): CodedExcerpt[] {
    return db
      .prepare("SELECT * FROM coded_excerpts WHERE transcript_id = ? ORDER BY start_offset ASC")
      .all(transcriptId) as CodedExcerpt[];
  },

  listByQualitativeCode(qualitativeCodeId: string): CodedExcerpt[] {
    return db
      .prepare("SELECT * FROM coded_excerpts WHERE qualitative_code_id = ? ORDER BY start_offset ASC")
      .all(qualitativeCodeId) as CodedExcerpt[];
  },

  create(input: {
    transcript_id: string;
    qualitative_code_id: string;
    interview_question_id: string;
    start_offset: number;
    end_offset: number;
    memo?: string | null;
  }): CodedExcerpt {
    const excerpt: CodedExcerpt = {
      id: newId(),
      transcript_id: input.transcript_id,
      qualitative_code_id: input.qualitative_code_id,
      interview_question_id: input.interview_question_id,
      start_offset: input.start_offset,
      end_offset: input.end_offset,
      memo: input.memo ?? null,
      created_at: nowIso(),
    };
    db.prepare(
      `INSERT INTO coded_excerpts
       (id, transcript_id, qualitative_code_id, interview_question_id, start_offset, end_offset, memo, created_at)
       VALUES
       (@id, @transcript_id, @qualitative_code_id, @interview_question_id, @start_offset, @end_offset, @memo, @created_at)`
    ).run(excerpt);
    return excerpt;
  },

  update(id: string, updates: Partial<Pick<CodedExcerpt, "qualitative_code_id" | "memo">>): CodedExcerpt | undefined {
    const existing = db.prepare("SELECT * FROM coded_excerpts WHERE id = ?").get(id) as CodedExcerpt | undefined;
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    db.prepare("UPDATE coded_excerpts SET qualitative_code_id = @qualitative_code_id, memo = @memo WHERE id = @id").run(
      updated
    );
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM coded_excerpts WHERE id = ?").run(id);
  },
};
