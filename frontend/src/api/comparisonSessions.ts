import { apiClient } from "./client";
import { CodebookShareBundle } from "./codebookShare";

export interface ComparisonSessionRecord {
  id: string;
  project_id: string;
  owner_name: string;
  bundle: CodebookShareBundle;
  accepted_code_names: string[];
  edited_by_code_name: Record<string, { label: string; definition: string }>;
  excluded_code_names: string[];
  excluded_right_keys: string[];
  created_at: string;
  updated_at: string;
}

export const comparisonSessionsApi = {
  /** Resolves to null (not an error) when there's nothing saved for this project. */
  get: async (projectId: string): Promise<ComparisonSessionRecord | null> => {
    try {
      return await apiClient.get<ComparisonSessionRecord>(`/comparison-sessions?project_id=${projectId}`);
    } catch {
      return null;
    }
  },
  save: (input: Omit<ComparisonSessionRecord, "id" | "created_at" | "updated_at">) =>
    apiClient.put<ComparisonSessionRecord>("/comparison-sessions", input),
  remove: (projectId: string) => apiClient.delete<void>(`/comparison-sessions?project_id=${projectId}`),
};
