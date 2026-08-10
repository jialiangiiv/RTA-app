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
  /** Idempotent: a duplicate label (within the codebook) returns the existing code with
   *  `reused: true` instead of erroring — callers should apply/select it and let the user know,
   *  rather than treating it as a failure. */
  create: (input: Omit<QualitativeCode, "id" | "created_at" | "deleted_at">) =>
    apiClient.post<QualitativeCode & { reused: boolean }>("/qualitative-codes", input),
  update: (id: string, updates: Partial<QualitativeCode>) =>
    apiClient.patch<QualitativeCode>(`/qualitative-codes/${id}`, updates),
  /** Soft-deletes the whole code (and, transitively, its highlights) — recoverable via restore(). */
  remove: (id: string) => apiClient.delete<void>(`/qualitative-codes/${id}`),
  listTrashed: (codebookId: string) =>
    apiClient.get<QualitativeCode[]>(`/qualitative-codes/trash?codebook_id=${codebookId}`),
  restore: (id: string) => apiClient.post<QualitativeCode>(`/qualitative-codes/${id}/restore`, {}),
  purge: (id: string) => apiClient.delete<void>(`/qualitative-codes/${id}/purge`),
  purgeAll: (codebookId: string) =>
    apiClient.post<{ purged: number }>(`/qualitative-codes/trash/purge-all`, { codebook_id: codebookId }),
  merge: (input: { sourceIds: string[]; targetId: string; label?: string; description?: string }) =>
    apiClient.post<QualitativeCode>("/qualitative-codes/merge", input),
};
