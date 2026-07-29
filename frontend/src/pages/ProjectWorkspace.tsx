import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { projectsApi } from "../api/projects";
import { researchQuestionsApi } from "../api/researchQuestions";
import { qualitativeCodesApi } from "../api/codebooks";
import { useInterviewQuestions } from "../hooks/useInterviewQuestions";
import { useCodedExcerpts } from "../hooks/useCodedExcerpts";
import { useBookmarks } from "../hooks/useBookmarks";
import { useCodebooks } from "../hooks/useCodebooks";
import { useQualitativeCodes } from "../hooks/useQualitativeCodes";
import { useActiveTranscript } from "../hooks/useActiveTranscript";
import { useResizableWidth } from "../hooks/useResizableWidth";
import { TranscriptList } from "../components/TranscriptList";
import { IQTab } from "../components/IQTab";
import { CodesTab } from "../components/CodesTab";
import { BookmarksPanel } from "../components/BookmarksPanel";
import { TranscriptView } from "../components/TranscriptView";
import { CompareView } from "../components/CompareView";
import { ResizeHandle } from "../components/ResizeHandle";
import { Project, QualitativeCode, TranscriptSummary, User } from "../types/domain";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const RIGHT_COLLAPSED_WIDTH = 36;

interface ProjectWorkspaceProps {
  currentUser: User;
}

type CenterMode = "coding" | "comparison";
type LeftTab = "documents" | "iq";
type RightTab = "codes" | "bookmarks";

export function ProjectWorkspace({ currentUser }: ProjectWorkspaceProps) {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  if (!projectIdParam) throw new Error("ProjectWorkspace requires a :projectId route param");
  const projectId: string = projectIdParam;

  const [project, setProject] = useState<Project | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([]);
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
  const [activeInterviewQuestionId, setActiveInterviewQuestionId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [centerMode, setCenterMode] = useState<CenterMode>("coding");
  const [leftTab, setLeftTab] = useState<LeftTab>("documents");
  const [rightTab, setRightTab] = useState<RightTab>("codes");
  const [rightHidden, setRightHidden] = useState(false);
  const { width: leftWidth, startDrag: startLeftDrag } = useResizableWidth(280, 200, 480, "right");
  const { width: rightWidth, startDrag: startRightDrag } = useResizableWidth(340, 260, 560, "left");

  const { interviewQuestions } = useInterviewQuestions(projectId);
  const { transcript: activeTranscript } = useActiveTranscript(activeTranscriptId);
  const { codedExcerpts, refresh: refreshCodedExcerpts } = useCodedExcerpts(activeTranscriptId);
  const { bookmarks, refresh: refreshBookmarks } = useBookmarks(activeTranscriptId, currentUser.id);
  const { codebooks, refresh: refreshCodebooks } = useCodebooks(projectId);

  // A Project can accumulate several Codebook *versions* over time (via archiving + comparison
  // merges) — only the one Project.active_codebook_id points at is live for coding right now.
  const versions = codebooks.filter((cb) => cb.kind === "own");
  const activeCodebook = versions.find((cb) => cb.id === project?.active_codebook_id) ?? versions[0] ?? null;
  const comparisonCodebooks = codebooks.filter((cb) => cb.kind === "comparison");
  const { qualitativeCodes, refresh: refreshCodes } = useQualitativeCodes(activeCodebook?.id ?? null);

  // Comparison-codebook codes (e.g. a colleague's shared codebook) can have real CodedExcerpts in
  // this Project's transcripts too — fetched separately so only own-codebook codes are offered for
  // applying to new selections, while both resolve correctly for rendering existing highlights.
  const [comparisonQualitativeCodes, setComparisonQualitativeCodes] = useState<QualitativeCode[]>([]);
  useEffect(() => {
    Promise.all(comparisonCodebooks.map((cb) => qualitativeCodesApi.listByCodebook(cb.id))).then((lists) =>
      setComparisonQualitativeCodes(lists.flat())
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonCodebooks.map((cb) => cb.id).join(",")]);

  function refreshProject() {
    projectsApi.get(projectId).then(setProject);
  }
  useEffect(refreshProject, [projectId]);

  // A Project with no RQs yet hasn't been through setup — send it there instead of an empty
  // workspace. Not a permanent gate: once RQs exist, this Project always opens straight here.
  useEffect(() => {
    researchQuestionsApi.listByProject(projectId).then((rqs) => {
      if (rqs.length === 0) navigate(`/projects/${projectId}/setup`, { replace: true });
    });
  }, [projectId, navigate]);

  // Auto-pick an IQ so coding never needs a blocking prompt: resume the last one used in this
  // Project, falling back to the first available. Never overrides an explicit user choice.
  useEffect(() => {
    if (activeInterviewQuestionId || interviewQuestions.length === 0) return;
    const lastUsed = window.localStorage.getItem(`rta.lastIQ.${projectId}`);
    const stillExists = lastUsed && interviewQuestions.some((iq) => iq.id === lastUsed);
    setActiveInterviewQuestionId(stillExists ? lastUsed! : interviewQuestions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewQuestions, projectId]);

  function selectInterviewQuestion(iqId: string) {
    setActiveInterviewQuestionId(iqId);
    window.localStorage.setItem(`rta.lastIQ.${projectId}`, iqId);
  }

  // Scrolls to and briefly rings a highlighted excerpt's span — used by the Codes tab's
  // "find highlights of this code" search so jumping between occurrences never needs new state.
  function handleJumpToExcerpt(excerptId: string) {
    const el = document.getElementById(`excerpt-${excerptId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-brand", "ring-offset-2");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-brand", "ring-offset-2"), 1200);
  }

  const qualitativeCodesById = useMemo(
    () => Object.fromEntries([...qualitativeCodes, ...comparisonQualitativeCodes].map((qc) => [qc.id, qc])),
    [qualitativeCodes, comparisonQualitativeCodes]
  );
  // CodedExcerpts from a Codebook version that isn't active anymore (e.g. after switching
  // versions) stay in the database but shouldn't show up while that version isn't the one in use.
  const visibleCodedExcerpts = useMemo(
    () => codedExcerpts.filter((e) => qualitativeCodesById[e.qualitative_code_id]),
    [codedExcerpts, qualitativeCodesById]
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/projects" className="text-sm text-muted-foreground hover:underline">
            ← Projects
          </Link>
          <h1 className="font-display text-xl">{project?.name ?? "…"}</h1>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/projects/${projectId}/setup`}>Project Setup</Link>
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/affinity-map`)}>
            Affinity Map
          </Button>
          {activeTranscript && centerMode === "coding" && (
            <Button variant="outline" size="sm" onClick={() => setCenterMode("comparison")}>
              Compare
            </Button>
          )}
        </div>
      </header>

      <div
        className="grid flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${leftWidth}px auto 1fr auto ${rightHidden ? RIGHT_COLLAPSED_WIDTH : rightWidth}px`,
        }}
      >
        <aside className="overflow-y-auto border-r bg-card/40 p-4">
          <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as LeftTab)}>
            <TabsList className="w-full">
              <TabsTrigger value="documents" className="flex-1">
                Documents
              </TabsTrigger>
              <TabsTrigger value="iq" className="flex-1">
                Interview Question
              </TabsTrigger>
            </TabsList>
            <TabsContent value="documents">
              <TranscriptList
                projectId={projectId}
                activeTranscriptId={activeTranscriptId}
                onActiveTranscriptChange={setActiveTranscriptId}
                onTranscriptsLoaded={setTranscripts}
              />
            </TabsContent>
            <TabsContent value="iq">
              <IQTab
                projectId={projectId}
                interviewQuestions={interviewQuestions}
                activeInterviewQuestionId={activeInterviewQuestionId}
                onActiveInterviewQuestionChange={selectInterviewQuestion}
              />
            </TabsContent>
          </Tabs>
        </aside>

        <ResizeHandle onMouseDown={startLeftDrag} />

        <main className="overflow-y-auto p-8">
          {!activeTranscript ? (
            <p className="text-sm text-muted-foreground">Select or import a Transcript in the Documents tab to begin coding.</p>
          ) : centerMode === "comparison" ? (
            <CompareView
              projectId={projectId}
              currentUserDisplayName={currentUser.display_name}
              activeTranscript={activeTranscript}
              leftCodedExcerpts={visibleCodedExcerpts}
              leftQualitativeCodesById={qualitativeCodesById}
              highlightColor={project?.highlight_color ?? "#b0461d"}
              onExit={() => setCenterMode("coding")}
              onFinished={() => {
                refreshProject();
                refreshCodebooks();
                refreshCodes();
                refreshCodedExcerpts();
              }}
            />
          ) : (
            <TranscriptView
              transcript={activeTranscript}
              codedExcerpts={visibleCodedExcerpts}
              qualitativeCodes={qualitativeCodes}
              qualitativeCodesById={qualitativeCodesById}
              ownCodebookId={activeCodebook?.id ?? null}
              highlightColor={project?.highlight_color ?? "#b0461d"}
              activeInterviewQuestionId={activeInterviewQuestionId}
              bookmarks={bookmarks}
              onExcerptsChanged={refreshCodedExcerpts}
              onCodesChanged={refreshCodes}
              onCursorMove={setCursorPosition}
            />
          )}
        </main>

        {rightHidden ? <div /> : <ResizeHandle onMouseDown={startRightDrag} />}
        {rightHidden ? (
          <div className="flex items-start justify-center border-l bg-card/40 p-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Show Codes panel" onClick={() => setRightHidden(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <aside className="overflow-y-auto border-l bg-card/40 p-4">
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Hide Codes panel" onClick={() => setRightHidden(true)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as RightTab)}>
              <TabsList className="w-full">
                <TabsTrigger value="codes" className="flex-1">
                  Codes
                </TabsTrigger>
                <TabsTrigger value="bookmarks" className="flex-1">
                  Bookmarks
                </TabsTrigger>
              </TabsList>
              <TabsContent value="codes">
                <CodesTab
                  projectId={projectId}
                  project={project}
                  ownCodebook={activeCodebook}
                  versions={versions}
                  qualitativeCodes={qualitativeCodes}
                  comparisonCodebooks={comparisonCodebooks}
                  transcripts={transcripts}
                  codedExcerpts={visibleCodedExcerpts}
                  onCodesChanged={refreshCodes}
                  onCodebooksChanged={() => {
                    refreshCodebooks();
                    refreshProject();
                  }}
                  onExcerptsChanged={refreshCodedExcerpts}
                  onJumpToExcerpt={handleJumpToExcerpt}
                />
              </TabsContent>
              <TabsContent value="bookmarks">
                {activeTranscriptId ? (
                  <BookmarksPanel
                    transcriptId={activeTranscriptId}
                    userId={currentUser.id}
                    bookmarks={bookmarks}
                    cursorPosition={cursorPosition}
                    onChanged={refreshBookmarks}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Select a Transcript first.</p>
                )}
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>
    </div>
  );
}
