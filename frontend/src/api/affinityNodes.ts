import { apiClient } from "./client";
import { AffinityNode } from "../types/domain";

export const affinityNodesApi = {
  listByProject: (projectId: string) => apiClient.get<AffinityNode[]>(`/affinity-nodes?project_id=${projectId}`),
  autoSeed: (projectId: string) => apiClient.post<AffinityNode[]>(`/affinity-nodes/auto-seed`, { project_id: projectId }),
  create: (input: {
    project_id: string;
    node_type: "section" | "theme" | "note";
    parent_id?: string | null;
    label?: string | null;
    body?: string | null;
    pos_x: number;
    pos_y: number;
    width?: number | null;
    height?: number | null;
    font_size?: number | null;
    color?: string | null;
  }) => apiClient.post<AffinityNode>("/affinity-nodes", input),
  update: (id: string, updates: Partial<AffinityNode>) => apiClient.patch<AffinityNode>(`/affinity-nodes/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/affinity-nodes/${id}`),
};
