import { apiClient } from "./client";
import { Transcript } from "../types/domain";

export const transcriptsApi = {
  listByProject: (projectId: string) => apiClient.get<Transcript[]>(`/transcripts?project_id=${projectId}`),
  get: (id: string) => apiClient.get<Transcript>(`/transcripts/${id}`),
  importFile: (input: { project_id: string; title: string; file: File; notes?: string }) => {
    const formData = new FormData();
    formData.append("project_id", input.project_id);
    formData.append("title", input.title);
    formData.append("file", input.file);
    if (input.notes) formData.append("notes", input.notes);
    return apiClient.post<Transcript>("/transcripts", formData);
  },
  remove: (id: string) => apiClient.delete<void>(`/transcripts/${id}`),
};
