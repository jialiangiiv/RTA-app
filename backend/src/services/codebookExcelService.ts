import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { db } from "../core/db";
import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { InterviewQuestion, Transcript } from "../models/types";

export interface CodebookExcelImportResult {
  codesCreated: number;
  codesReused: number;
  codesFailed: number;
  excerptsCreated: number;
  /** Rows whose (iq_label, iq_text) didn't match any Interview Question in this project — code
   *  and highlight are both skipped entirely for these, since a CodedExcerpt always needs an IQ. */
  unmappedIq: Array<{ document_name: string; iq_label: string; iq_text: string; code_name: string }>;
  /** Rows whose IQ matched but the highlight couldn't be created — the code is still imported. */
  notFound: Array<{ document_name: string; code_name: string; highlight_text: string; reason: string }>;
  failedCodes: Array<{ code_name: string; iq_label: string; reason: string }>;
}

const EXPECTED_HEADERS = ["document_name", "iq_label", "iq_text", "code_name", "code_definition", "highlight_text"];

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Collapses all whitespace runs (including line breaks) to a single space and trims — used to
 *  compare IQ label/text loosely, independent of how a spreadsheet cell happens to wrap them. */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a regex that matches `needle` inside a larger string while tolerating any difference in
 *  whitespace/line-break runs — each whitespace run in `needle` becomes `\s+` in the pattern, so a
 *  highlight copied out of a spreadsheet cell (which may have normalized its own newlines) still
 *  lines up with the original transcript text. Matches are found directly against the ORIGINAL,
 *  unnormalized haystack, so returned offsets are valid indices into it. */
export function findAllOccurrences(haystack: string, needle: string): Array<{ start: number; end: number }> {
  const trimmedNeedle = needle.trim();
  if (!trimmedNeedle) return [];
  const pattern = trimmedNeedle
    .split(/\s+/)
    .map((token) => escapeRegExp(token))
    .join("\\s+");
  const regex = new RegExp(pattern, "g");
  const matches: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(haystack)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length });
    if (match[0].length === 0) regex.lastIndex++;
  }
  return matches;
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
   * Parses a 6-column .xlsx (headers "document_name", "iq_label", "iq_text", "code_name",
   * "code_definition", "highlight_text", any order, case-insensitive) into the Project's own
   * Codebook, creating real CodedExcerpts — unlike the old 3-column format, this one fully
   * round-trips a codebook onto this project's own transcripts. Per row:
   *  1. Match (iq_label, iq_text) against this Project's Interview Questions — no match means the
   *     whole row is skipped (into `unmappedIq`), since a CodedExcerpt always needs an IQ.
   *  2. Upsert a code scoped to that IQ (same code_name reused if it already exists under that
   *     exact IQ; a different IQ gets its own code entity even with the same name).
   *  3. Locate `document_name` among this project's transcripts (by file_name) and `highlight_text`
   *     within it (whitespace/line-break tolerant, first occurrence wins) to create the excerpt —
   *     failures here land in `notFound` but don't undo the code creation/reuse above.
   *
   * Accepts both .xlsx and .csv — `fileName`'s extension picks which ExcelJS reader parses `buffer`
   * (defaults to .xlsx if the name is missing/ambiguous, matching this endpoint's original format).
   */
  async importFromBuffer(projectId: string, buffer: Buffer, fileName?: string): Promise<CodebookExcelImportResult> {
    const workbook = new ExcelJS.Workbook();
    const isCsv = (fileName ?? "").toLowerCase().endsWith(".csv");
    const sheet = isCsv
      ? await workbook.csv.read(Readable.from(buffer))
      : await (async () => {
          await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
          return workbook.worksheets[0];
        })();
    if (!sheet) throw new Error("The workbook has no sheets.");

    const headerRow = sheet.getRow(1);
    const colByHeader = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      colByHeader.set(normalize(String(cell.value ?? "")).replace(/\s+/g, "_"), colNumber);
    });
    const cols = {
      document_name: colByHeader.get("document_name"),
      iq_label: colByHeader.get("iq_label"),
      iq_text: colByHeader.get("iq_text"),
      code_name: colByHeader.get("code_name"),
      code_definition: colByHeader.get("code_definition"),
      highlight_text: colByHeader.get("highlight_text"),
    };
    const missing = EXPECTED_HEADERS.filter((h) => !cols[h as keyof typeof cols]);
    if (missing.length > 0) {
      throw new Error(`Missing column(s): ${missing.join(", ")}.`);
    }

    return db.transaction((): CodebookExcelImportResult => {
      const codebook = codebooksService.ensureOwnCodebook(projectId);
      const existingCodes = qualitativeCodesService.listByCodebook(codebook.id);
      const codesByIqAndLabel = new Map(
        existingCodes.map((qc) => [`${qc.interview_question_id ?? "∅"}|${normalize(qc.label)}`, qc])
      );

      const localIqs = interviewQuestionsService.listByProject(projectId);
      const iqsByLabelAndText = new Map(
        localIqs.map((iq) => [`${normalize(normalizeWhitespace(iq.label))}|${normalize(normalizeWhitespace(iq.text))}`, iq])
      );

      const localTranscripts = transcriptsService.listByProject(projectId);
      const transcriptsByFileName = new Map(localTranscripts.map((t) => [t.file_name.trim(), t]));

      const existingExcerptKeysByTranscript = new Map<string, Set<string>>();
      function existingExcerptKeys(transcriptId: string): Set<string> {
        if (!existingExcerptKeysByTranscript.has(transcriptId)) {
          existingExcerptKeysByTranscript.set(
            transcriptId,
            new Set(
              codedExcerptsService
                .listByTranscript(transcriptId)
                .map((e) => `${e.qualitative_code_id}|${e.start_offset}|${e.end_offset}`)
            )
          );
        }
        return existingExcerptKeysByTranscript.get(transcriptId)!;
      }

      let codesCreated = 0;
      let codesReused = 0;
      let codesFailed = 0;
      let excerptsCreated = 0;
      const unmappedIq: CodebookExcelImportResult["unmappedIq"] = [];
      const notFound: CodebookExcelImportResult["notFound"] = [];
      const failedCodes: CodebookExcelImportResult["failedCodes"] = [];

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const documentName = cellText(row, cols.document_name!).trim();
        const iqLabel = cellText(row, cols.iq_label!).trim();
        const iqText = cellText(row, cols.iq_text!).trim();
        const codeName = cellText(row, cols.code_name!).trim();
        const codeDefinition = cellText(row, cols.code_definition!).trim();
        const highlightText = cellText(row, cols.highlight_text!).trim();
        if (!documentName && !iqLabel && !iqText && !codeName && !highlightText) continue; // fully blank row

        const iq: InterviewQuestion | undefined = iqsByLabelAndText.get(
          `${normalize(normalizeWhitespace(iqLabel))}|${normalize(normalizeWhitespace(iqText))}`
        );
        if (!iq) {
          unmappedIq.push({ document_name: documentName, iq_label: iqLabel, iq_text: iqText, code_name: codeName });
          continue;
        }

        let codeId: string;
        const codeKey = `${iq.id}|${normalize(codeName)}`;
        const existingCode = codesByIqAndLabel.get(codeKey);
        try {
          if (existingCode) {
            const updated = qualitativeCodesService.update(existingCode.id, {
              description: codeDefinition || existingCode.description,
            });
            codeId = updated!.id;
            codesReused++;
          } else {
            const created = qualitativeCodesService.create({
              codebook_id: codebook.id,
              interview_question_id: iq.id,
              label: codeName,
              description: codeDefinition || codeName,
              theme: null,
              example_quote: null,
              color: null,
            });
            codesByIqAndLabel.set(codeKey, created);
            codeId = created.id;
            codesCreated++;
          }
        } catch (err) {
          codesFailed++;
          failedCodes.push({ code_name: codeName, iq_label: iqLabel, reason: (err as Error).message });
          continue;
        }

        const transcript: Transcript | undefined = transcriptsByFileName.get(documentName);
        if (!transcript) {
          notFound.push({
            document_name: documentName,
            code_name: codeName,
            highlight_text: highlightText,
            reason: `No transcript found named "${documentName}".`,
          });
          continue;
        }

        const occurrences = findAllOccurrences(transcript.raw_text, highlightText);
        if (occurrences.length === 0) {
          notFound.push({
            document_name: documentName,
            code_name: codeName,
            highlight_text: highlightText,
            reason: "Highlight text not found in transcript.",
          });
          continue;
        }

        const { start, end } = occurrences[0];
        const keys = existingExcerptKeys(transcript.id);
        const dedupeKey = `${codeId}|${start}|${end}`;
        if (keys.has(dedupeKey)) continue; // already imported (e.g. re-running the same file)

        codedExcerptsService.create({
          transcript_id: transcript.id,
          qualitative_code_id: codeId,
          interview_question_id: iq.id,
          start_offset: start,
          end_offset: end,
          memo: null,
        });
        keys.add(dedupeKey);
        excerptsCreated++;
      }

      return { codesCreated, codesReused, codesFailed, excerptsCreated, unmappedIq, notFound, failedCodes };
    })();
  },
};
