import { useCallback, useEffect, useState } from "react";
import { bookmarksApi } from "../api/bookmarks";
import { Bookmark } from "../types/domain";

export function useBookmarks(transcriptId: string | null, userId: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!transcriptId) {
      setBookmarks([]);
      return;
    }
    setLoading(true);
    setBookmarks(await bookmarksApi.listByTranscriptAndUser(transcriptId, userId));
    setLoading(false);
  }, [transcriptId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bookmarks, loading, refresh };
}
