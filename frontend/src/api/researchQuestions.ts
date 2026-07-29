import { apiClient } from "./client";
import { ResearchQuestion } from "../types/domain";

export const researchQuestionsApi = {
  listByProject: (projectId: string) =>
    apiClient.get<ResearchQuestion[]>(`/research-questions?project_id=${projectId}`),
  create: (input: { project_id: string; label: string; text: string; notes?: string }) =>
    apiClient.post<ResearchQuestion>("/research-questions", input),
  update: (id: string, updates: Partial<ResearchQuestion>) =>
    apiClient.patch<ResearchQuestion>(`/research-questions/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/research-questions/${id}`),
};
