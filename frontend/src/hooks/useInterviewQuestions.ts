import { useCallback, useEffect, useState } from "react";
import { interviewQuestionsApi } from "../api/interviewQuestions";
import { InterviewQuestion } from "../types/domain";

export function useInterviewQuestions(projectId: string | null) {
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setInterviewQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setInterviewQuestions(await interviewQuestionsApi.listByProject(projectId));
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

  return { interviewQuestions, loading, error, refresh };
}
