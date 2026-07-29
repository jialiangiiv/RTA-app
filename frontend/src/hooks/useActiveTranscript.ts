import { useCallback, useEffect, useState } from "react";
import { transcriptsApi } from "../api/transcripts";
import { Transcript } from "../types/domain";

/** Fetches the full Transcript (with raw_text) for whichever one is active — the project's Transcript
 *  list itself only carries summaries, so the body is loaded lazily for just this one at a time. */
export function useActiveTranscript(transcriptId: string | null) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!transcriptId) {
      setTranscript(null);
      return;
    }
    setLoading(true);
    try {
      setTranscript(await transcriptsApi.get(transcriptId));
    } finally {
      setLoading(false);
    }
  }, [transcriptId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transcript, loading, refresh };
}
