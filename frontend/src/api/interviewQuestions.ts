import { apiClient } from "./client";
import { InterviewQuestion } from "../types/domain";

export const interviewQuestionsApi = {
  listByProject: (projectId: string) =>
    apiClient.get<InterviewQuestion[]>(`/interview-questions?project_id=${projectId}`),
  listByResearchQuestion: (researchQuestionId: string) =>
    apiClient.get<InterviewQuestion[]>(`/interview-questions?research_question_id=${researchQuestionId}`),
  create: (input: Omit<InterviewQuestion, "id" | "created_at" | "sort_order">) =>
    apiClient.post<InterviewQuestion>("/interview-questions", input),
  update: (id: string, updates: Partial<InterviewQuestion>) =>
    apiClient.patch<InterviewQuestion>(`/interview-questions/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/interview-questions/${id}`),
};
