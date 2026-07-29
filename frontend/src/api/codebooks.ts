import { apiClient } from "./client";
import { Codebook, QualitativeCode } from "../types/domain";

export const codebooksApi = {
  listByProject: (projectId: string) => apiClient.get<Codebook[]>(`/codebooks?project_id=${projectId}`),
  getOwn: (projectId: string) => apiClient.get<Codebook>(`/codebooks/own?project_id=${projectId}`),
  get: (id: string) => apiClient.get<Codebook>(`/codebooks/${id}`),
  remove: (id: string) => apiClient.delete<void>(`/codebooks/${id}`),
  /** Read-only .xlsx snapshot — importing a Codebook only happens via the JSON share flow, see codebookShareApi. */
  exportUrl: (id: string) => `/api/codebooks/${id}/export`,
};

export const qualitativeCodesApi = {
  listByCodebook: (codebookId: string) =>
    apiClient.get<QualitativeCode[]>(`/qualitative-codes?codebook_id=${codebookId}`),
  create: (input: Omit<QualitativeCode, "id" | "created_at">) =>
    apiClient.post<QualitativeCode>("/qualitative-codes", input),
  update: (id: string, updates: Partial<QualitativeCode>) =>
    apiClient.patch<QualitativeCode>(`/qualitative-codes/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/qualitative-codes/${id}`),
};
