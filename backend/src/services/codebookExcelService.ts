import ExcelJS from "exceljs";
import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";

const COLUMNS = ["CodeName", "CodeDefinition", "InterviewQuestion", "HighlightedText"] as const;

export const codebookExcelService = {
  /**
   * Builds a read-only .xlsx snapshot of a Codebook: one row per CodedExcerpt (code name, its
   * definition, which Interview Question it was coded against, and the exact highlighted
   * text). Export-only — re-importing a Codebook only happens via the JSON share flow now
   * (see codebookShareService), so this never needs to parse a workbook back.
   */
  async exportToBuffer(codebookId: string): Promise<Buffer> {
    const codebook = codebooksService.get(codebookId);
    if (!codebook) throw new Error("Codebook not found");
    const codes = qualitativeCodesService.listByCodebook(codebookId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Codes");
    sheet.addRow([...COLUMNS]);

    for (const code of codes) {
      const excerpts = codedExcerptsService.listByQualitativeCode(code.id);
      if (excerpts.length === 0) {
        sheet.addRow([code.label, code.description, "", ""]);
        continue;
      }
      for (const excerpt of excerpts) {
        const transcript = transcriptsService.get(excerpt.transcript_id);
        const iq = interviewQuestionsService.get(excerpt.interview_question_id);
        sheet.addRow([
          code.label,
          code.description,
          iq?.label ?? "",
          transcript?.raw_text.slice(excerpt.start_offset, excerpt.end_offset) ?? "",
        ]);
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  },
};
