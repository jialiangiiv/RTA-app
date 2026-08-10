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

  /** Every CodedExcerpt across the whole Project (any Transcript) coded against this Interview
   *  Question — powers the workspace's "codes for this IQ" default filter. */
  listByInterviewQuestion(interviewQuestionId: string): CodedExcerpt[] {
    return db
      .prepare("SELECT * FROM coded_excerpts WHERE interview_question_id = ?")
      .all(interviewQuestionId) as CodedExcerpt[];
  },

  /** Distinct interview_question_ids each code in this Codebook has actually been applied under,
   *  across every Transcript in the Project — since a code is no longer scoped to one "home" IQ
   *  (see qualitativeCodesService), this is the real source of truth for "which IQ(s) does this
   *  code belong to", derived from its CodedExcerpts rather than any field on the code itself. */
  codeInterviewQuestionMap(codebookId: string): Record<string, string[]> {
    const rows = db
      .prepare(
        `SELECT DISTINCT ce.qualitative_code_id AS code_id, ce.interview_question_id AS iq_id
         FROM coded_excerpts ce
         JOIN qualitative_codes qc ON qc.id = ce.qualitative_code_id
         WHERE qc.codebook_id = ?`
      )
      .all(codebookId) as { code_id: string; iq_id: string }[];
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      (map[row.code_id] ??= []).push(row.iq_id);
    }
    return map;
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
