import { useCallback, useEffect, useState } from "react";
import { codedExcerptsApi } from "../api/codedExcerpts";

/** Distinct qualitative_code_ids with at least one CodedExcerpt under this Interview Question,
 *  across the whole Project (any Transcript) — powers the workspace's default "codes for this
 *  IQ only" filter (right column + the highlight/add-code card). */
export function useCodeIdsForInterviewQuestion(interviewQuestionId: string | null) {
  const [codeIds, setCodeIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!interviewQuestionId) {
      setCodeIds(new Set());
      return;
    }
    const excerpts = await codedExcerptsApi.listByInterviewQuestion(interviewQuestionId);
    setCodeIds(new Set(excerpts.map((e) => e.qualitative_code_id)));
  }, [interviewQuestionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { codeIds, refresh };
}
