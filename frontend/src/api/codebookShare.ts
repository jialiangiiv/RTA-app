import { apiClient } from "./client";

export interface CodebookShareBundle {
  project: {
    name: string;
    description: string | null;
    highlight: string;
    /** The exporter's active Codebook version label — informational only; import never applies it automatically. */
    codebook_version?: string;
  };
  questions: Array<{
    rq_label: string;
    rq_text: string;
    iq_label: string;
    iq_text: string;
    iq_description: string | null;
    "other meta info": string;
  }>;
  transcripts: Array<{ transcript_file_name: string }>;
  codes: Array<{
    code_name: string;
    code_definition: string;
    rq_label: string;
    rq_text: string;
    iq_label: string;
    iq_text: string;
  }>;
  coded_excerpts: Array<{
    code_name: string;
    transcript_file_name: string;
    start_offset: number;
    end_offset: number;
  }>;
}

export interface CodebookShareImportResult {
  codesCreated: number;
  codesUpdated: number;
  excerptsCreated: number;
  excerptsSkipped: number;
}

export interface CodebookExcelImportResult {
  codesCreated: number;
  codesReused: number;
  codesFailed: number;
  excerptsCreated: number;
  unmappedIq: Array<{ document_name: string; iq_label: string; iq_text: string; code_name: string }>;
  notFound: Array<{ document_name: string; code_name: string; highlight_text: string; reason: string }>;
  failedCodes: Array<{ code_name: string; iq_label: string; reason: string }>;
}

export const codebookShareApi = {
  exportUrl: (projectId: string) => `/api/projects/${projectId}/codebook-export`,
  parseFile: async (file: File): Promise<CodebookShareBundle> => JSON.parse(await file.text()),
  import: (projectId: string, bundle: CodebookShareBundle, mode: "merge" | "substitute") =>
    apiClient.post<CodebookShareImportResult>(`/projects/${projectId}/codebook-import`, { bundle, mode }),
  /** 6-column .xlsx or .csv (document_name / iq_label / iq_text / code_name / code_definition /
   *  highlight_text) — creates real CodedExcerpts by locating each highlight in its transcript. */
  importExcel: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<CodebookExcelImportResult>(`/projects/${projectId}/codebook-import-excel`, formData);
  },
};
