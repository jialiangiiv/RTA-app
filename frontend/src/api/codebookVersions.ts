import { apiClient } from "./client";
import { Codebook } from "../types/domain";

export interface AcceptedCode {
  code_name: string;
  code_definition: string;
  iq_label: string;
  iq_text: string;
  coded_excerpts: Array<{ transcript_file_name: string; start_offset: number; end_offset: number }>;
}

export interface FinishResult {
  codebook: Codebook;
  codesCarried: number;
  codesAccepted: number;
  excerptsCreated: number;
  excerptsSkipped: number;
  excerptsByTranscript: Array<{ file_name: string; count: number }>;
}

export const codebookVersionsApi = {
  list: (projectId: string) =>
    apiClient.get<{ versions: Codebook[]; activeCodebookId: string | null }>(
      `/projects/${projectId}/codebook-versions`
    ),
  activate: (projectId: string, codebookId: string) =>
    apiClient.post<Codebook>(`/projects/${projectId}/codebook-versions/${codebookId}/activate`, {}),
  finish: (projectId: string, input: { version_label: string; owner_name: string; accepted: AcceptedCode[] }) =>
    apiClient.post<FinishResult>(`/projects/${projectId}/codebook-versions/finish`, input),
};
