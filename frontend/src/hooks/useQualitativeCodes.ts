import { useCallback, useEffect, useState } from "react";
import { qualitativeCodesApi } from "../api/codebooks";
import { QualitativeCode } from "../types/domain";

export function useQualitativeCodes(codebookId: string | null) {
  const [qualitativeCodes, setQualitativeCodes] = useState<QualitativeCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!codebookId) {
      setQualitativeCodes([]);
      return;
    }
    setLoading(true);
    try {
      setQualitativeCodes(await qualitativeCodesApi.listByCodebook(codebookId));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [codebookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { qualitativeCodes, loading, error, refresh };
}
