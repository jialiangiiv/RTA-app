import { useCallback, useEffect, useState } from "react";
import { codebooksApi } from "../api/codebooks";
import { Codebook } from "../types/domain";

export function useCodebooks(projectId: string) {
  const [codebooks, setCodebooks] = useState<Codebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCodebooks(await codebooksApi.listByProject(projectId));
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

  return { codebooks, loading, error, refresh };
}
