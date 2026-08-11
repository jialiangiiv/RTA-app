import { useMemo, useState } from "react";
import { useResearchQuestions } from "../hooks/useResearchQuestions";
import { InterviewQuestion } from "../types/domain";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface IQTabProps {
  projectId: string;
  interviewQuestions: InterviewQuestion[];
  activeInterviewQuestionId: string | null;
  onActiveInterviewQuestionChange: (iqId: string) => void;
}

/** Searchable picker for the workspace's left column. RQ/IQ creation and editing (including
 *  display order) lives on the Project Setup page. */
export function IQTab({
  projectId,
  interviewQuestions,
  activeInterviewQuestionId,
  onActiveInterviewQuestionChange,
}: IQTabProps) {
  const { researchQuestions } = useResearchQuestions(projectId);
  const rqLabelById = Object.fromEntries(researchQuestions.map((rq) => [rq.id, rq.label]));
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return interviewQuestions;
    return interviewQuestions.filter(
      (iq) => iq.label.toLowerCase().includes(q) || iq.text.toLowerCase().includes(q)
    );
  }, [interviewQuestions, search]);

  if (interviewQuestions.length === 0) {
    return <p className="text-sm text-muted-foreground">No Interview Questions yet — set them up via Project Setup.</p>;
  }

  return (
    <div className="space-y-2">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search interview questions" />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Interview Questions match "{search}".</p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((iq) => {
            const isActive = iq.id === activeInterviewQuestionId;
            return (
              <li key={iq.id}>
                <button
                  className={cn(
                    "w-full rounded-md border-l-2 border-transparent p-2 text-left text-sm transition-colors hover:bg-accent",
                    isActive && "border-brand bg-accent"
                  )}
                  onClick={() => onActiveInterviewQuestionChange(iq.id)}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {rqLabelById[iq.research_question_id] ?? "—"}
                  </p>
                  <p className={cn("font-medium", isActive && "text-brand")}>{iq.label}</p>
                  <p className="text-xs text-muted-foreground">{iq.text}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
