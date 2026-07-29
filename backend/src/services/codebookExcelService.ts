import ExcelJS from "exceljs";
import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";

export const codebookExcelService = {
  /**
   * Builds a read-only .xlsx snapshot of a Codebook: one row per code (InterviewQuestion, code
   * name, definition), followed by one "Highlight Text N" column per occurrence — however many
   * the code with the most excerpts has. Each highlight cell also names its source Transcript
   * (e.g. "word for word cloned (P1.docx)") so the sheet reads standalone outside the app.
   * Export-only — re-importing a Codebook only happens via the JSON share flow now (see
   * codebookShareService), so this never needs to parse a workbook back.
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
};
