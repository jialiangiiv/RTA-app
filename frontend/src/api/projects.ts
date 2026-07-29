import { apiClient } from "./client";
import { Project } from "../types/domain";

export const projectsApi = {
  list: () => apiClient.get<Project[]>("/projects"),
  listComparisonSources: () => apiClient.get<Project[]>("/projects/comparison-sources"),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`),
  create: (input: { name: string; description?: string }) => apiClient.post<Project>("/projects", input),
  update: (id: string, updates: Partial<Project>) => apiClient.patch<Project>(`/projects/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/projects/${id}`),
  move: (id: string, direction: "up" | "down") => apiClient.post<Project[]>(`/projects/${id}/move`, { direction }),
  exportUrl: (id: string) => `/api/projects/${id}/export`,
  importFromFile: async (input: { file: File; asComparisonSource: boolean }) => {
    const bundle = JSON.parse(await input.file.text());
    return apiClient.post<Project>("/projects/import", { bundle, as_comparison_source: input.asComparisonSource });
  },
};
