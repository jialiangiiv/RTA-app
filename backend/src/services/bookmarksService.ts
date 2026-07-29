import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { Bookmark } from "../models/types";

export const bookmarksService = {
  listByTranscriptAndUser(transcriptId: string, userId: string): Bookmark[] {
    return db
      .prepare("SELECT * FROM bookmarks WHERE transcript_id = ? AND user_id = ? ORDER BY position ASC")
      .all(transcriptId, userId) as Bookmark[];
  },

  /** All Bookmarks for a Transcript regardless of User — used for full Project export. */
  listByTranscript(transcriptId: string): Bookmark[] {
    return db
      .prepare("SELECT * FROM bookmarks WHERE transcript_id = ? ORDER BY position ASC")
      .all(transcriptId) as Bookmark[];
  },

  create(input: { transcript_id: string; user_id: string; position: number; label: string }): Bookmark {
    const bookmark: Bookmark = {
      id: newId(),
      transcript_id: input.transcript_id,
      user_id: input.user_id,
      position: input.position,
      label: input.label,
      created_at: nowIso(),
    };
    db.prepare(
      `INSERT INTO bookmarks (id, transcript_id, user_id, position, label, created_at)
       VALUES (@id, @transcript_id, @user_id, @position, @label, @created_at)`
    ).run(bookmark);
    return bookmark;
  },

  update(id: string, updates: Partial<Pick<Bookmark, "position" | "label">>): Bookmark | undefined {
    const existing = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as Bookmark | undefined;
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    db.prepare("UPDATE bookmarks SET position = @position, label = @label WHERE id = @id").run(updated);
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
  },
};
