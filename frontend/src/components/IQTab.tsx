import { useResearchQuestions } from "../hooks/useResearchQuestions";
import { InterviewQuestion } from "../types/domain";
import { cn } from "@/lib/utils";

interface IQTabProps {
  projectId: string;
  interviewQuestions: InterviewQuestion[];
  activeInterviewQuestionId: string | null;
  onActiveInterviewQuestionChange: (iqId: string) => void;
}

/** Read-only picker for the workspace's left column. RQ/IQ creation lives on the Project Setup page. */
export function IQTab({ projectId, interviewQuestions, activeInterviewQuestionId, onActiveInterviewQuestionChange }: IQTabProps) {
  const { researchQuestions } = useResearchQuestions(projectId);
  const rqLabelById = Object.fromEntries(researchQuestions.map((rq) => [rq.id, rq.label]));

  if (interviewQuestions.length === 0) {
    return <p className="text-sm text-muted-foreground">No Interview Questions yet — set them up via Project Setup.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {interviewQuestions.map((iq) => {
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
  );
}
