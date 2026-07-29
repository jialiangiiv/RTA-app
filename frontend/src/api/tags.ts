import { apiClient } from "./client";
import { AffinityNodeTag, Tag } from "../types/domain";

export const tagsApi = {
  listByProject: (projectId: string) => apiClient.get<Tag[]>(`/tags?project_id=${projectId}`),
  listAssignments: (projectId: string) => apiClient.get<AffinityNodeTag[]>(`/tags/assignments?project_id=${projectId}`),
  create: (input: { project_id: string; name: string; color?: string }) => apiClient.post<Tag>("/tags", input),
  update: (id: string, updates: Partial<Pick<Tag, "name" | "color">>) => apiClient.patch<Tag>(`/tags/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/tags/${id}`),
  assign: (tagId: string, affinityNodeId: string) =>
    apiClient.post<void>(`/tags/${tagId}/assign`, { affinity_node_id: affinityNodeId }),
  unassign: (tagId: string, affinityNodeId: string) => apiClient.delete<void>(`/tags/${tagId}/assign/${affinityNodeId}`),
};
