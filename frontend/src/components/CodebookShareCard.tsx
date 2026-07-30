import { ChangeEvent, useRef, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import {
  codebookShareApi,
  CodebookExcelImportResult,
  CodebookShareBundle,
  CodebookShareImportResult,
} from "../api/codebookShare";
import { codebooksApi } from "../api/codebooks";
import { Project, TranscriptSummary } from "../types/domain";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface CodebookShareCardProps {
  projectId: string;
  project: Project | null;
  ownCodebookId: string | null;
  ownCodebookVersionLabel: string | null;
  transcripts: TranscriptSummary[];
  onImported: () => void;
}

interface FieldCheck {
  label: string;
  local: string;
  imported: string;
  mismatch: boolean;
}

interface TranscriptCheck {
  name: string;
  ok: boolean;
}

type Step =
  | { kind: "review"; bundle: CodebookShareBundle; fields: FieldCheck[]; transcriptChecks: TranscriptCheck[] }
  | { kind: "merge-choice"; bundle: CodebookShareBundle }
  | { kind: "importing" }
  | { kind: "done"; result: CodebookShareImportResult }
  | { kind: "error"; message: string };

/** Kept fully separate from `Step` above (the .json review/merge flow) so the Excel path can
 *  never affect its behavior. */
type ExcelStep = { kind: "importing" } | { kind: "done"; result: CodebookExcelImportResult } | { kind: "error"; message: string };

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Sharing a Codebook + its CodedExcerpts between two coders on the SAME Project — matches by
 * human-readable name (transcript file name, code name, Interview Question label) rather than
 * database ids, since the importer holds their own separate database. Never touches Bookmarks.
 */
export function CodebookShareCard({
  projectId,
  project,
  ownCodebookId,
  ownCodebookVersionLabel,
  transcripts,
  onImported,
}: CodebookShareCardProps) {
  const [step, setStep] = useState<Step | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [excelStep, setExcelStep] = useState<ExcelStep | null>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);

  async function handlePickExcelFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (excelFileRef.current) excelFileRef.current.value = "";
    if (!file) return;
    setExcelStep({ kind: "importing" });
    try {
      const result = await codebookShareApi.importExcel(projectId, file);
      setExcelStep({ kind: "done", result });
      onImported();
    } catch (err) {
      setExcelStep({ kind: "error", message: (err as Error).message });
    }
  }

  function closeExcel() {
    setExcelStep(null);
  }

  async function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !project) return;
    setParseError(null);
    try {
      const bundle = await codebookShareApi.parseFile(file);

      const fields: FieldCheck[] = [
        {
          label: "Project name",
          local: project.name,
          imported: bundle.project.name,
          mismatch: normalize(project.name) !== normalize(bundle.project.name),
        },
        {
          label: "Description",
          local: project.description ?? "—",
          imported: bundle.project.description ?? "—",
          mismatch: normalize(project.description ?? "") !== normalize(bundle.project.description ?? ""),
        },
      ];

      const localFileNames = new Set(transcripts.map((t) => t.file_name));
      const transcriptChecks: TranscriptCheck[] = bundle.transcripts.map((t) => ({
        name: t.transcript_file_name,
        ok: localFileNames.has(t.transcript_file_name),
      }));

      setStep({ kind: "review", bundle, fields, transcriptChecks });
    } catch {
      setParseError("Couldn't read that file — is it a Codebook Share export (.json)?");
    }
  }

  async function runImport(bundle: CodebookShareBundle, mode: "merge" | "substitute") {
    setStep({ kind: "importing" });
    try {
      const result = await codebookShareApi.import(projectId, bundle, mode);
      setStep({ kind: "done", result });
      onImported();
    } catch (err) {
      setStep({ kind: "error", message: (err as Error).message });
    }
  }

  function close() {
    setStep(null);
  }

  const hasMismatch =
    step?.kind === "review" && (step.fields.some((f) => f.mismatch) || step.transcriptChecks.some((t) => !t.ok));

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <input ref={fileRef} type="file" accept=".json" onChange={handlePickFile} className="hidden" />
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
          Import Codebook (.json)
        </Button>
        <p className="text-xs text-muted-foreground">
          Automatically highlights the matching text in your transcripts.
        </p>
      </div>

      <div className="space-y-1">
        <input ref={excelFileRef} type="file" accept=".xlsx" onChange={handlePickExcelFile} className="hidden" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={excelStep?.kind === "importing"}
          onClick={() => excelFileRef.current?.click()}
        >
          {excelStep?.kind === "importing" ? "Importing…" : "Import Codebook (Excel)"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Needs three columns: IQ Text, Code Name, Code Definition — codes are grouped by Interview
          Question but not highlighted in the text.
        </p>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-full">
            Export Codebook <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          <a
            className="block rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            href={codebookShareApi.exportUrl(projectId)}
          >
            Export as JSON (.json)
          </a>
          {ownCodebookId && (
            <a
              className="block rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              href={codebooksApi.exportUrl(ownCodebookId)}
            >
              Export as Excel (.xlsx)
            </a>
          )}
        </PopoverContent>
      </Popover>
      {parseError && <p className="text-xs text-destructive">{parseError}</p>}

      <Dialog open={step !== null} onOpenChange={(open) => !open && step?.kind !== "importing" && close()}>
        <DialogContent>
          {step?.kind === "review" && (
            <>
              <DialogHeader>
                <DialogTitle>Review shared codebook</DialogTitle>
                <DialogDescription>
                  {hasMismatch
                    ? "Some project info or transcripts don't match — please make sure you have the same transcripts before importing."
                    : "Matches this project's info and transcripts."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="mb-1 grid grid-cols-[7rem_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
                    <span></span>
                    <span>This project</span>
                    <span>Imported</span>
                  </div>
                  {step.fields.map((f) => (
                    <div
                      key={f.label}
                      className={`grid grid-cols-[7rem_1fr_1fr] gap-2 ${f.mismatch ? "text-destructive" : ""}`}
                    >
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="truncate">{f.local}</span>
                      <span className="truncate">{f.imported}</span>
                    </div>
                  ))}
                  {/* Informational only — differing codebook versions are expected, not a mismatch to warn about. */}
                  <div className="grid grid-cols-[7rem_1fr_1fr] gap-2">
                    <span className="text-muted-foreground">Codebook version</span>
                    <span className="truncate">{ownCodebookVersionLabel ?? "—"}</span>
                    <span className="truncate">{step.bundle.project.codebook_version ?? "—"}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Transcripts</p>
                  <ul className="space-y-0.5">
                    {step.transcriptChecks.map((t) => (
                      <li key={t.name} className={t.ok ? undefined : "text-destructive"}>
                        {t.name}
                        {!t.ok && " (not found in this project)"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={close} autoFocus={hasMismatch}>
                  Cancel
                </Button>
                <Button
                  variant={hasMismatch ? "destructive" : "default"}
                  size="sm"
                  onClick={() => setStep({ kind: "merge-choice", bundle: step.bundle })}
                >
                  {hasMismatch ? "Continue Anyway" : "Continue"}
                </Button>
              </DialogFooter>
            </>
          )}

          {step?.kind === "merge-choice" && (
            <>
              <DialogHeader>
                <DialogTitle>Incorporate codes</DialogTitle>
                <DialogDescription>
                  How should these {step.bundle.codes.length} code{step.bundle.codes.length === 1 ? "" : "s"} be added
                  to your codebook?
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={() => runImport(step.bundle, "merge")}>
                  Merge into my codes
                </Button>
                <Button variant="outline" size="sm" onClick={() => runImport(step.bundle, "substitute")}>
                  Substitute all my codes
                </Button>
                <p className="text-xs text-muted-foreground">
                  Substitute deletes any of my codes not in this file, along with their highlights.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={close}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}

          {step?.kind === "importing" && (
            <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Importing shared codebook…
            </div>
          )}

          {step?.kind === "done" && (
            <>
              <DialogHeader>
                <DialogTitle>Import complete</DialogTitle>
                <DialogDescription>
                  {step.result.codesCreated} code{step.result.codesCreated === 1 ? "" : "s"} added,{" "}
                  {step.result.codesUpdated} updated, {step.result.excerptsCreated} excerpt
                  {step.result.excerptsCreated === 1 ? "" : "s"} highlighted
                  {step.result.excerptsSkipped > 0 ? ` (${step.result.excerptsSkipped} skipped).` : "."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button size="sm" onClick={close}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}

          {step?.kind === "error" && (
            <>
              <DialogHeader>
                <DialogTitle>Import failed</DialogTitle>
                <DialogDescription className="text-destructive">{step.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button size="sm" onClick={close}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={excelStep !== null} onOpenChange={(open) => !open && closeExcel()}>
        <DialogContent>
          {excelStep?.kind === "importing" && (
            <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Importing Excel codebook…
            </div>
          )}

          {excelStep?.kind === "done" && (
            <>
              <DialogHeader>
                <DialogTitle>Excel import complete</DialogTitle>
                <DialogDescription>
                  {excelStep.result.codesCreated} code{excelStep.result.codesCreated === 1 ? "" : "s"} added,{" "}
                  {excelStep.result.codesUpdated} updated. No highlights were created.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                {excelStep.result.byInterviewQuestion.length === 0 ? (
                  <p className="text-muted-foreground">No rows matched an Interview Question by text.</p>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Codes by Interview Question
                    </p>
                    <ul className="space-y-0.5">
                      {excelStep.result.byInterviewQuestion.map((r) => (
                        <li key={r.iq_label}>
                          {r.iq_label}: {r.count} code{r.count === 1 ? "" : "s"}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {excelStep.result.unmatchedIqCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {excelStep.result.unmatchedIqCount} row{excelStep.result.unmatchedIqCount === 1 ? "" : "s"} didn't
                    match any Interview Question by text.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button size="sm" onClick={closeExcel}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}

          {excelStep?.kind === "error" && (
            <>
              <DialogHeader>
                <DialogTitle>Excel import failed</DialogTitle>
                <DialogDescription className="text-destructive">{excelStep.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button size="sm" onClick={closeExcel}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
