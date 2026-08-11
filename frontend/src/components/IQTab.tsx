import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useResearchQuestions } from "../hooks/useResearchQuestions";
import { interviewQuestionsApi } from "../api/interviewQuestions";
import { InterviewQuestion } from "../types/domain";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface IQTabProps {
  projectId: string;
  interviewQuestions: InterviewQuestion[];
  activeInterviewQuestionId: string | null;
  onActiveInterviewQuestionChange: (iqId: string) => void;
  /** Called after a reorder — the caller should refetch and pass back the fresh, re-sorted list. */
  onReordered: () => void;
}

/** Picker for the workspace's left column — user-searchable and user-orderable (see move() below);
 *  RQ/IQ creation itself still lives on the Project Setup page. */
export function IQTab({
  projectId,
  interviewQuestions,
  activeInterviewQuestionId,
  onActiveInterviewQuestionChange,
  onReordered,
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

  async function move(iqId: string, direction: "up" | "down") {
    await interviewQuestionsApi.move(iqId, direction);
    onReordered();
  }

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
            // Reordering always moves within the true (unfiltered) order, not the filtered view —
            // boundary-disable the arrows against that real position, not this list's index.
            const trueIndex = interviewQuestions.findIndex((x) => x.id === iq.id);
            return (
              <li key={iq.id} className="flex items-center gap-1">
                <button
                  className={cn(
                    "min-w-0 flex-1 rounded-md border-l-2 border-transparent p-2 text-left text-sm transition-colors hover:bg-accent",
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
                <div className="flex shrink-0 flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Move up"
                    disabled={trueIndex === 0}
                    onClick={() => move(iq.id, "up")}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Move down"
                    disabled={trueIndex === interviewQuestions.length - 1}
                    onClick={() => move(iq.id, "down")}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
