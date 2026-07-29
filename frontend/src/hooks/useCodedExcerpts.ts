import { useCallback, useEffect, useState } from "react";
import { codedExcerptsApi } from "../api/codedExcerpts";
import { CodedExcerpt } from "../types/domain";

export function useCodedExcerpts(transcriptId: string | null) {
  const [codedExcerpts, setCodedExcerpts] = useState<CodedExcerpt[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!transcriptId) {
      setCodedExcerpts([]);
      return;
    }
    setLoading(true);
    setCodedExcerpts(await codedExcerptsApi.listByTranscript(transcriptId));
    setLoading(false);
  }, [transcriptId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { codedExcerpts, loading, refresh };
}
