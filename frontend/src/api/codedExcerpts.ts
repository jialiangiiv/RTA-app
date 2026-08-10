import { apiClient } from "./client";
import { CodedExcerpt } from "../types/domain";

export const codedExcerptsApi = {
  listByTranscript: (transcriptId: string) =>
    apiClient.get<CodedExcerpt[]>(`/coded-excerpts?transcript_id=${transcriptId}`),
  listByInterviewQuestion: (interviewQuestionId: string) =>
    apiClient.get<CodedExcerpt[]>(`/coded-excerpts?interview_question_id=${interviewQuestionId}`),
  create: (input: Omit<CodedExcerpt, "id" | "created_at">) =>
    apiClient.post<CodedExcerpt>("/coded-excerpts", input),
  update: (id: string, updates: Partial<Pick<CodedExcerpt, "qualitative_code_id" | "memo">>) =>
    apiClient.patch<CodedExcerpt>(`/coded-excerpts/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/coded-excerpts/${id}`),
  /** Distinct interview_question_ids each code in this Codebook has actually been used under,
   *  across every Transcript in the Project — keyed by qualitative_code_id. */
  iqMapByCodebook: (codebookId: string) =>
    apiClient.get<Record<string, string[]>>(`/coded-excerpts/iq-map?codebook_id=${codebookId}`),
};
