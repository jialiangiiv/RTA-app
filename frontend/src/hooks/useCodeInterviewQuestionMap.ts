import { useCallback, useEffect, useState } from "react";
import { codedExcerptsApi } from "../api/codedExcerpts";

/** Distinct Interview Question ids each code in this Codebook has actually been used under
 *  (derived from its CodedExcerpts, project-wide) — powers the codes sidebar's "used under"
 *  display. See codedExcerptsService.codeInterviewQuestionMap on the backend. */
export function useCodeInterviewQuestionMap(codebookId: string | null) {
  const [map, setMap] = useState<Record<string, string[]>>({});

  const refresh = useCallback(async () => {
    if (!codebookId) {
      setMap({});
      return;
    }
    setMap(await codedExcerptsApi.iqMapByCodebook(codebookId));
  }, [codebookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { codeInterviewQuestionIds: map, refresh };
}
