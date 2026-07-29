import { ChangeEvent, FormEvent, RefObject, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useResearchQuestions } from "../hooks/useResearchQuestions";
import { useInterviewQuestions } from "../hooks/useInterviewQuestions";
import { projectsApi } from "../api/projects";
import { researchQuestionsApi } from "../api/researchQuestions";
import { interviewQuestionsApi } from "../api/interviewQuestions";
import { codebookShareApi } from "../api/codebookShare";
import { InterviewQuestion, Project, ResearchQuestion, TranscriptSummary } from "../types/domain";
import { TranscriptList } from "../components/TranscriptList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

/** Sections reveal progressively for a brand-new Project; an existing one shows everything at once. */
type Step = 0 | 1 | 2 | 3 | 4;

export function ProjectSetupPage() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>(routeProjectId ? 4 : 0);
  const [transcriptCount, setTranscriptCount] = useState(0);

  useEffect(() => {
    if (routeProjectId) projectsApi.get(routeProjectId).then(setProject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProjectId]);

  const { researchQuestions, loading: rqLoading, error: rqError, refresh: refreshRQs } =
    useResearchQuestions(project?.id ?? null);
  const { interviewQuestions, loading: iqLoading, error: iqError, refresh: refreshIQs } =
    useInterviewQuestions(project?.id ?? null);

  function advanceTo(next: Step) {
    setStep((s) => (next > s ? next : s));
  }

  // Each new section scrolls into view as it appears, so the user never has to hunt for it —
  // skipped on first mount, since an existing Project shows every section at once already.
  const rqSectionRef = useRef<HTMLDivElement>(null);
  const iqSectionRef = useRef<HTMLDivElement>(null);
  const docsSectionRef = useRef<HTMLDivElement>(null);
  const codebookSectionRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const sectionRefByStep: Partial<Record<Step, RefObject<HTMLDivElement>>> = {
      1: rqSectionRef,
      2: iqSectionRef,
      3: docsSectionRef,
      4: codebookSectionRef,
    };
    sectionRefByStep[step]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function handleProjectSaved(p: Project, isNew: boolean) {
    setProject(p);
    if (isNew) {
      // Move off the id-less /projects/new/setup URL now that a real Project exists.
      navigate(`/projects/${p.id}/setup`, { replace: true });
      advanceTo(1);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <Link to="/projects" className="text-sm text-muted-foreground hover:underline">
        ← Back to Dashboard
      </Link>
      <header className="mb-8 mt-2 animate-fade-in space-y-1">
        <h1 className="text-3xl">Project Setup</h1>
        <p className="text-muted-foreground">
          Set up your project step by step — each section appears once the one above it is done. You can always come
          back to this page later.
        </p>
      </header>

      <div className="space-y-6">
        <Card className="animate-fade-in [animation-delay:60ms]">
          <CardHeader>
            <CardTitle>1. Project</CardTitle>
            <CardDescription>Name and describe this project, and choose the color used to highlight coded text.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectInfoForm project={project} onSaved={handleProjectSaved} isFirstStep={step === 0} />
          </CardContent>
        </Card>

        {step >= 1 && project && (
          <Card ref={rqSectionRef} className="animate-fade-in">
            <CardHeader>
              <CardTitle>2. Research Questions</CardTitle>
              <CardDescription>Project-level questions your interviews are trying to answer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rqLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {rqError && <p className="text-sm font-medium text-destructive">{rqError}</p>}
              <RQList researchQuestions={researchQuestions} onChanged={refreshRQs} />
              <Separator />
              <NewRQForm projectId={project.id} nextDefaultLabel={`RQ${researchQuestions.length + 1}`} onCreated={refreshRQs} />
              {step === 1 && (
                <div className="flex flex-col items-end gap-1 pt-2">
                  <Button onClick={() => advanceTo(2)} disabled={researchQuestions.length === 0}>
                    Continue
                  </Button>
                  {researchQuestions.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add at least one Research Question to continue.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step >= 2 && project && (
          <Card ref={iqSectionRef} className="animate-fade-in">
            <CardHeader>
              <CardTitle>3. Interview Questions</CardTitle>
              <CardDescription>The concrete questions asked in interviews, each linked to a parent RQ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {iqLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {iqError && <p className="text-sm font-medium text-destructive">{iqError}</p>}
              {researchQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add a Research Question above first — every Interview Question needs a parent RQ.</p>
              ) : (
                <>
                  <IQGroupedList researchQuestions={researchQuestions} interviewQuestions={interviewQuestions} onChanged={refreshIQs} />
                  <Separator />
                  <NewIQForm projectId={project.id} researchQuestions={researchQuestions} onCreated={refreshIQs} />
                </>
              )}
              {step === 2 && (
                <div className="flex flex-col items-end gap-1 pt-2">
                  <Button onClick={() => advanceTo(3)} disabled={interviewQuestions.length === 0}>
                    Continue
                  </Button>
                  {interviewQuestions.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add at least one Interview Question to continue.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step >= 3 && project && (
          <Card ref={docsSectionRef} className="animate-fade-in">
            <CardHeader>
              <CardTitle>4. Documents</CardTitle>
              <CardDescription>Import the interview transcripts (.docx/.pdf) this project will code.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TranscriptList
                projectId={project.id}
                activeTranscriptId={null}
                onActiveTranscriptChange={() => {}}
                onTranscriptsLoaded={(transcripts: TranscriptSummary[]) => setTranscriptCount(transcripts.length)}
              />
              {step === 3 && (
                <div className="flex justify-end pt-2">
                  <Button onClick={() => advanceTo(4)}>{transcriptCount === 0 ? "Skip for now" : "Continue"}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step >= 4 && project && (
          <Card ref={codebookSectionRef} className="animate-fade-in">
            <CardHeader>
              <CardTitle>5. Codebook</CardTitle>
              <CardDescription>Bring in an existing codebook, or start fresh and build one as you code.</CardDescription>
            </CardHeader>
            <CardContent>
              <CodebookImportPrompt projectId={project.id} />
            </CardContent>
          </Card>
        )}
      </div>

      {step >= 4 && project && (
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={() => navigate(`/projects/${project.id}`)}>
            Enter Workspace →
          </Button>
        </div>
      )}
    </div>
  );
}

function ProjectInfoForm({
  project,
  onSaved,
  isFirstStep,
}: {
  project: Project | null;
  onSaved: (project: Project, isNew: boolean) => void;
  isFirstStep: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [highlightColor, setHighlightColor] = useState("#f8fc1f");
  const [codebookVersion, setCodebookVersion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setHighlightColor(project?.highlight_color ?? "#f8fc1f");
  }, [project?.id, project?.name, project?.description, project?.highlight_color]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!project && !codebookVersion.trim()) return;
    setSaving(true);
    try {
      if (!project) {
        const created = await projectsApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          codebook_version: codebookVersion.trim(),
        });
        const withColor = await projectsApi.update(created.id, { highlight_color: highlightColor });
        onSaved(withColor, true);
      } else {
        const updated = await projectsApi.update(project.id, {
          name: name.trim(),
          description: description.trim() || null,
          highlight_color: highlightColor,
        });
        onSaved(updated, false);
      }
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-3">
        <Label htmlFor="project-name" className="text-sm">Project name:</Label>
        <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Human Factor Study" />

        {!project && (
          <>
            <Label htmlFor="project-codebook-version" className="text-sm">Codebook version:</Label>
            <Input
              id="project-codebook-version"
              value={codebookVersion}
              onChange={(e) => setCodebookVersion(e.target.value)}
              placeholder="v1"
            />
          </>
        )}

        <Label htmlFor="project-description" className="self-start pt-2 text-sm">Project description:</Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What this project is investigating"
        />

        <Label htmlFor="project-highlight-color" className="text-sm">Highlight color:</Label>
        <input
          id="project-highlight-color"
          type="color"
          value={highlightColor}
          onChange={(e) => setHighlightColor(e.target.value)}
          className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background"
        />
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="submit"
          disabled={!name.trim() || (!project && !codebookVersion.trim()) || saving}
          variant={isFirstStep ? "default" : "outline"}
          size={isFirstStep ? "default" : "sm"}
        >
          {isFirstStep ? "Continue" : "Save changes"}
        </Button>
        {isFirstStep && !name.trim() && <p className="text-xs text-muted-foreground">Enter a project name to continue.</p>}
        {isFirstStep && name.trim() && !codebookVersion.trim() && (
          <p className="text-xs text-muted-foreground">Enter a codebook version (e.g. v1) to continue.</p>
        )}
      </div>
    </form>
  );
}

function RQList({ researchQuestions, onChanged }: { researchQuestions: ResearchQuestion[]; onChanged: () => void }) {
  if (researchQuestions.length === 0) return <p className="text-sm text-muted-foreground">No Research Questions yet.</p>;
  return (
    <ul className="divide-y rounded-md border">
      {researchQuestions.map((rq) => (
        <li key={rq.id} className="flex items-start justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="font-medium">{rq.label}</p>
            <p className="text-sm text-muted-foreground">{rq.text}</p>
            {rq.notes && <p className="text-xs text-muted-foreground">{rq.notes}</p>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={async () => {
              try {
                await researchQuestionsApi.remove(rq.id);
                onChanged();
              } catch (err) {
                window.alert((err as Error).message);
              }
            }}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

function NewRQForm({
  projectId,
  nextDefaultLabel,
  onCreated,
}: {
  projectId: string;
  nextDefaultLabel: string;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState(nextDefaultLabel);
  const [labelTouched, setLabelTouched] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!labelTouched) setLabel(nextDefaultLabel);
  }, [nextDefaultLabel, labelTouched]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const finalLabel = label.trim() || nextDefaultLabel;
    try {
      await researchQuestionsApi.create({ project_id: projectId, label: finalLabel, text: text.trim() });
      setLabelTouched(false);
      setText("");
      onCreated();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={handleSubmit}>
      <Input
        className="sm:w-32"
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setLabelTouched(true);
        }}
        placeholder="Label (e.g. RQ1)"
      />
      <Input
        className="flex-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Full research question text"
      />
      <Button type="submit" disabled={!text.trim()}>
        Add RQ
      </Button>
    </form>
  );
}

function IQGroupedList({
  researchQuestions,
  interviewQuestions,
  onChanged,
}: {
  researchQuestions: ResearchQuestion[];
  interviewQuestions: InterviewQuestion[];
  onChanged: () => void;
}) {
  return (
    <div className="space-y-5">
      {researchQuestions.map((rq) => {
        const iqs = interviewQuestions.filter((iq) => iq.research_question_id === rq.id);
        return (
          <div key={rq.id} className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{rq.label}</h4>
            {iqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Interview Questions yet under this RQ.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {iqs.map((iq) => {
                  const metadata: [string, string][] = [
                    ["Description", iq.description ?? ""],
                    ["Smallest component", iq.smallest_component ?? ""],
                    ["Selection criterion", iq.selection_criterion_definition ?? ""],
                    ["Level of abstraction", iq.level_of_abstraction ?? ""],
                  ].filter(([, value]) => value) as [string, string][];

                  return (
                    <li key={iq.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                          <dt className="text-muted-foreground">Label:</dt>
                          <dd className="font-medium">{iq.label}</dd>
                          <dt className="text-muted-foreground">Interview question:</dt>
                          <dd>{iq.text}</dd>
                        </dl>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={async () => {
                            try {
                              await interviewQuestionsApi.remove(iq.id);
                              onChanged();
                            } catch (err) {
                              window.alert((err as Error).message);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      {metadata.length > 0 && (
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 border-t pt-2 text-xs">
                          {metadata.map(([key, value]) => (
                            <div key={key} className="contents">
                              <dt className="text-muted-foreground">{key}:</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewIQForm({
  projectId,
  researchQuestions,
  onCreated,
}: {
  projectId: string;
  researchQuestions: ResearchQuestion[];
  onCreated: () => void;
}) {
  const [researchQuestionId, setResearchQuestionId] = useState(researchQuestions[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [smallestComponent, setSmallestComponent] = useState("");
  const [selectionCriterion, setSelectionCriterion] = useState("");
  const [levelOfAbstraction, setLevelOfAbstraction] = useState("");

  const canSubmit = Boolean(researchQuestionId && label.trim() && text.trim());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await interviewQuestionsApi.create({
        project_id: projectId,
        research_question_id: researchQuestionId,
        label: label.trim(),
        text: text.trim(),
        description: description.trim() || null,
        smallest_component: smallestComponent.trim() || null,
        selection_criterion_definition: selectionCriterion.trim() || null,
        level_of_abstraction: levelOfAbstraction.trim() || null,
      });
      setLabel("");
      setText("");
      setDescription("");
      setSmallestComponent("");
      setSelectionCriterion("");
      setLevelOfAbstraction("");
      onCreated();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  return (
    <form className="space-y-3 rounded-md border p-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-2">
        <Label className="text-xs text-muted-foreground">Research question:</Label>
        <Select value={researchQuestionId} onValueChange={setResearchQuestionId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {researchQuestions.map((rq) => (
              <SelectItem key={rq.id} value={rq.id}>
                {rq.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="text-xs text-muted-foreground">Label:</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 1.1 Interview Protocol Section" />

        <Label className="text-xs text-muted-foreground">Interview question:</Label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="The exact question as asked in the interview"
        />
      </div>

      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-2 rounded-md border p-3">
        <Label className="text-xs text-muted-foreground">Description:</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this question is meant to explore"
        />
        <Label className="text-xs text-muted-foreground">Smallest component:</Label>
        <Input
          value={smallestComponent}
          onChange={(e) => setSmallestComponent(e.target.value)}
          placeholder="Smallest unit of text that can be coded, e.g. one sentence"
        />
        <Label className="text-xs text-muted-foreground">Selection criterion:</Label>
        <Input
          value={selectionCriterion}
          onChange={(e) => setSelectionCriterion(e.target.value)}
          placeholder="How to decide a passage counts as an instance of this"
        />
        <Label className="text-xs text-muted-foreground">Level of abstraction:</Label>
        <Input
          value={levelOfAbstraction}
          onChange={(e) => setLevelOfAbstraction(e.target.value)}
          placeholder="e.g. Descriptive, Interpretive, Conceptual"
        />
      </div>
      <Button type="submit" disabled={!canSubmit}>
        Add IQ
      </Button>
    </form>
  );
}

function CodebookImportPrompt({ projectId }: { projectId: string }) {
  const [wantsImport, setWantsImport] = useState<boolean | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  }

  async function importNow() {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const bundle = await codebookShareApi.parseFile(pendingFile);
      await codebookShareApi.import(projectId, bundle, "merge");
      setDone(true);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  if (done) return <p className="text-sm text-muted-foreground">Codebook imported — your codes are ready in the workspace.</p>;

  if (wantsImport === null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm">Do you have an existing codebook (.json) to import?</p>
        <Button variant="outline" onClick={() => setWantsImport(true)}>
          Yes, import one
        </Button>
        <Button variant="outline" onClick={() => setWantsImport(false)}>
          No, start fresh
        </Button>
      </div>
    );
  }

  if (wantsImport === false) {
    return <p className="text-sm text-muted-foreground">Starting with an empty codebook — add codes as you code.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handlePickFile} className="hidden" />
      {!pendingFile ? (
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Choose .json file
        </Button>
      ) : (
        <>
          <p className="flex-1 basis-full text-sm">
            <strong>{pendingFile.name}</strong> — since this is a fresh setup, its codes just load straight in.
          </p>
          <Button disabled={importing} onClick={importNow}>
            Import Codebook
          </Button>
          <Button variant="outline" onClick={() => setPendingFile(null)}>
            Choose a different file
          </Button>
        </>
      )}
    </div>
  );
}
