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
};
