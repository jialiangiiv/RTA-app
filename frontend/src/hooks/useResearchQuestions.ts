import { useCallback, useEffect, useState } from "react";
import { researchQuestionsApi } from "../api/researchQuestions";
import { ResearchQuestion } from "../types/domain";

export function useResearchQuestions(projectId: string | null) {
  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setResearchQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setResearchQuestions(await researchQuestionsApi.listByProject(projectId));
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

  return { researchQuestions, loading, error, refresh };
}
