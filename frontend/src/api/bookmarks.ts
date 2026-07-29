import { apiClient } from "./client";
import { Bookmark } from "../types/domain";

export const bookmarksApi = {
  listByTranscriptAndUser: (transcriptId: string, userId: string) =>
    apiClient.get<Bookmark[]>(`/bookmarks?transcript_id=${transcriptId}&user_id=${userId}`),
  create: (input: Omit<Bookmark, "id" | "created_at">) => apiClient.post<Bookmark>("/bookmarks", input),
  update: (id: string, updates: Partial<Pick<Bookmark, "position" | "label">>) =>
    apiClient.patch<Bookmark>(`/bookmarks/${id}`, updates),
  remove: (id: string) => apiClient.delete<void>(`/bookmarks/${id}`),
};
