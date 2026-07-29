import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { researchQuestionsApi } from "../api/researchQuestions";
import { qualitativeCodesApi } from "../api/codebooks";
import { useInterviewQuestions } from "../hooks/useInterviewQuestions";
import { useCodedExcerpts } from "../hooks/useCodedExcerpts";
import { useBookmarks } from "../hooks/useBookmarks";
import { useCodebooks } from "../hooks/useCodebooks";
import { useQualitativeCodes } from "../hooks/useQualitativeCodes";
import { TranscriptList } from "../components/TranscriptList";
import { IQTab } from "../components/IQTab";
import { CodesTab } from "../components/CodesTab";
import { BookmarksPanel } from "../components/BookmarksPanel";
import { TranscriptView } from "../components/TranscriptView";
import { CompareView } from "../components/CompareView";
import { Project, QualitativeCode, Transcript, User } from "../types/domain";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
  const [activeInterviewQuestionId, setActiveInterviewQuestionId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [centerMode, setCenterMode] = useState<CenterMode>("coding");
  const [leftTab, setLeftTab] = useState<LeftTab>("documents");
  const [rightTab, setRightTab] = useState<RightTab>("codes");

  const { interviewQuestions } = useInterviewQuestions(projectId);
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

  const activeTranscript = transcripts.find((t) => t.id === activeTranscriptId) ?? null;
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
          {activeTranscript && centerMode === "coding" && (
            <Button variant="outline" size="sm" onClick={() => setCenterMode("comparison")}>
              Compare
            </Button>
          )}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[280px_1fr_340px] overflow-hidden">
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
              onArchived={refreshCodebooks}
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

        <aside className="overflow-y-auto border-l bg-card/40 p-4">
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
                onCodesChanged={refreshCodes}
                onCodebooksChanged={() => {
                  refreshCodebooks();
                  refreshProject();
                }}
                onExcerptsChanged={refreshCodedExcerpts}
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
      </div>
    </div>
  );
}
