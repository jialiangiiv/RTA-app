import { useCallback, useEffect, useState } from "react";
import { transcriptsApi } from "../api/transcripts";
import { Transcript } from "../types/domain";

export function useTranscripts(projectId: string) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTranscripts(await transcriptsApi.listByProject(projectId));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transcripts, loading, error, refresh };
}
