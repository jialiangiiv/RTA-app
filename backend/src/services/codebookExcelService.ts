import ExcelJS from "exceljs";
import { db } from "../core/db";
import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";

export interface CodebookExcelImportResult {
  codesCreated: number;
  codesUpdated: number;
  byInterviewQuestion: Array<{ iq_label: string; count: number }>;
  /** Rows whose "IQ Text" didn't match any Interview Question in this project — the code is still
   *  imported, just without a known IQ to group it under in the import summary. */
  unmatchedIqCount: number;
}

const EXPECTED_HEADERS = ["iq text", "code name", "code definition"];

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function cellText(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "richText" in value) {
    return ((value as { richText: Array<{ text: string }> }).richText ?? []).map((r) => r.text).join("");
  }
  return String(value);
}

export const codebookExcelService = {
  /**
   * Builds a read-only .xlsx snapshot of a Codebook: one row per code (InterviewQuestion, code
   * name, definition), followed by one "Highlight Text N" column per occurrence — however many
   * the code with the most excerpts has. Each highlight cell also names its source Transcript
   * (e.g. "word for word cloned (P1.docx)") so the sheet reads standalone outside the app.
   * This shape is export-only (highlight columns can't be round-tripped back into offsets) — a
   * separate, simpler layout is what importFromBuffer below actually parses.
   */
  async exportToBuffer(codebookId: string): Promise<Buffer> {
    const codebook = codebooksService.get(codebookId);
    if (!codebook) throw new Error("Codebook not found");
    const codes = qualitativeCodesService.listByCodebook(codebookId);

    const rows = codes.map((code) => {
      const excerpts = codedExcerptsService.listByQualitativeCode(code.id);
      const firstIq = excerpts.length > 0 ? interviewQuestionsService.get(excerpts[0].interview_question_id) : undefined;
      const highlights = excerpts.map((excerpt) => {
        const transcript = transcriptsService.get(excerpt.transcript_id);
        const text = transcript?.raw_text.slice(excerpt.start_offset, excerpt.end_offset) ?? "";
        return transcript ? `${text} (${transcript.file_name})` : text;
      });
      return { iq: firstIq?.label ?? "", label: code.label, description: code.description, highlights };
    });

    const maxHighlights = rows.reduce((max, r) => Math.max(max, r.highlights.length), 0);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Codes");
    const highlightHeaders = Array.from({ length: maxHighlights }, (_, i) => `Highlight Text ${i + 1}`);
    sheet.addRow(["InterviewQuestion", "CodeName", "CodeDefinition", ...highlightHeaders]);

    for (const row of rows) {
      const padded = [...row.highlights, ...Array(maxHighlights - row.highlights.length).fill("")];
      sheet.addRow([row.iq, row.label, row.description, ...padded]);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  },

  /**
   * Parses a plain 3-column .xlsx (headers "IQ Text", "Code Name", "Code Definition", any order,
   * case-insensitive) into the Project's own Codebook — merge-by-label, same upsert semantics as
   * codebookShareService's JSON import (existing label -> update definition, else create). Each
   * row's "IQ Text" is matched against this Project's Interview Questions (by text, falling back
   * to label) purely to group the import summary by IQ; it never creates a CodedExcerpt, since a
   * spreadsheet row carries no transcript/offset to highlight — that's the JSON share flow's job.
   */
  async importFromBuffer(projectId: string, buffer: Buffer): Promise<CodebookExcelImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("The workbook has no sheets.");

    const headerRow = sheet.getRow(1);
    const colByHeader = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      colByHeader.set(normalize(String(cell.value ?? "")), colNumber);
    });
    const iqTextCol = colByHeader.get("iq text");
    const codeNameCol = colByHeader.get("code name");
    const codeDefinitionCol = colByHeader.get("code definition");
    const missing = EXPECTED_HEADERS.filter((h) => !colByHeader.has(h));
    if (missing.length > 0 || !iqTextCol || !codeNameCol || !codeDefinitionCol) {
      throw new Error(`Missing column(s): ${missing.join(", ") || "IQ Text, Code Name, Code Definition"}.`);
    }

    return db.transaction((): CodebookExcelImportResult => {
      const codebook = codebooksService.ensureOwnCodebook(projectId);
      const existingCodes = qualitativeCodesService.listByCodebook(codebook.id);
      const byLabel = new Map(existingCodes.map((qc) => [normalize(qc.label), qc]));

      const localIqs = interviewQuestionsService.listByProject(projectId);
      const iqsByText = new Map(localIqs.map((iq) => [normalize(iq.text), iq]));
      const iqsByLabel = new Map(localIqs.map((iq) => [normalize(iq.label), iq]));

      let codesCreated = 0;
      let codesUpdated = 0;
      let unmatchedIqCount = 0;
      const countByIqLabel = new Map<string, number>();

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const codeName = cellText(row, codeNameCol).trim();
        if (!codeName) continue;
        const codeDefinition = cellText(row, codeDefinitionCol).trim();
        const iqText = cellText(row, iqTextCol).trim();

        const key = normalize(codeName);
        const match = byLabel.get(key);
        if (match) {
          qualitativeCodesService.update(match.id, { description: codeDefinition || match.description });
          codesUpdated++;
        } else {
          const created = qualitativeCodesService.create({
            codebook_id: codebook.id,
            label: codeName,
            description: codeDefinition || codeName,
            theme: null,
            example_quote: null,
            color: null,
          });
          byLabel.set(key, created);
          codesCreated++;
        }

        const iq = iqsByText.get(normalize(iqText)) ?? iqsByLabel.get(normalize(iqText));
        if (iq) {
          countByIqLabel.set(iq.label, (countByIqLabel.get(iq.label) ?? 0) + 1);
        } else {
          unmatchedIqCount++;
        }
      }

      return {
        codesCreated,
        codesUpdated,
        byInterviewQuestion: Array.from(countByIqLabel, ([iq_label, count]) => ({ iq_label, count })),
        unmatchedIqCount,
      };
    })();
  },
};
