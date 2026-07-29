import { FormEvent, useState } from "react";
import { bookmarksApi } from "../api/bookmarks";
import { Bookmark } from "../types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BookmarksPanelProps {
  transcriptId: string;
  userId: string;
  bookmarks: Bookmark[];
  cursorPosition: number | null;
  onChanged: () => void;
}

export function BookmarksPanel({ transcriptId, userId, bookmarks, cursorPosition, onChanged }: BookmarksPanelProps) {
  const [label, setLabel] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || cursorPosition === null) return;
    await bookmarksApi.create({
      transcript_id: transcriptId,
      user_id: userId,
      position: cursorPosition,
      label: label.trim(),
    });
    setLabel("");
    onChanged();
  }

  function jumpTo(bookmarkId: string) {
    document.getElementById(`bookmark-${bookmarkId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleRemove(id: string) {
    await bookmarksApi.remove(id);
    onChanged();
  }

  return (
    <div className="space-y-4 pt-4">
      {bookmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Bookmarks yet.</p>
      ) : (
        <ul className="space-y-1 rounded-md border p-1">
          {bookmarks.map((b) => (
            <li key={b.id} className="flex items-center gap-1">
              <button
                className="flex-1 truncate rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => jumpTo(b.id)}
              >
                ⚑ {b.label}
              </button>
              <button
                className="px-2 text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => handleRemove(b.id)}
                title="Delete bookmark"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-2" onSubmit={handleAdd}>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={cursorPosition === null ? "Click in transcript first" : "Bookmark label"}
          disabled={cursorPosition === null}
        />
        <Button type="submit" variant="outline" size="sm" className="w-full" disabled={cursorPosition === null}>
          Add at cursor
        </Button>
      </form>
    </div>
  );
}
