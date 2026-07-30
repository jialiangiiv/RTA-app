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
  const [toolsOpen, setToolsOpen] = useState(false);
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
      <input ref={fileRef} type="file" accept=".json" onChange={handlePickFile} className="hidden" />
      <input ref={excelFileRef} type="file" accept=".xlsx,.csv" onChange={handlePickExcelFile} className="hidden" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-between"
        onClick={() => setToolsOpen((open) => !open)}
      >
        Codebook Import / Export
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
      </Button>

      {toolsOpen && (
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
              Import (.json)
            </Button>
            <p className="text-xs text-muted-foreground">
              Import a Codebook Share export from another coder on this project — automatically
              highlights the matching text in your transcripts.
            </p>
          </div>
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={excelStep?.kind === "importing"}
              onClick={() => excelFileRef.current?.click()}
            >
              {excelStep?.kind === "importing" ? "Importing…" : "Import (Excel/CSV)"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Import codes and highlights from a spreadsheet (document_name, iq_label, iq_text,
              code_name, code_definition, highlight_text columns).
            </p>
          </div>
          <div className="space-y-1">
            <Button asChild type="button" variant="outline" size="sm" className="w-full">
              <a href={codebookShareApi.exportUrl(projectId)}>Export (.json)</a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Download this project's codes and highlights to share with another coder.
            </p>
          </div>
          <div className="space-y-1">
            {ownCodebookId ? (
              <Button asChild type="button" variant="outline" size="sm" className="w-full">
                <a href={codebooksApi.exportUrl(ownCodebookId)}>Export (.xlsx)</a>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-full" disabled>
                Export (.xlsx)
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Download a read-only spreadsheet snapshot of this codebook's codes and highlights.
            </p>
          </div>
        </div>
      )}
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
                  {excelStep.result.codesReused} reused
                  {excelStep.result.codesFailed > 0
                    ? `, ${excelStep.result.codesFailed} failed`
                    : ""}
                  . {excelStep.result.excerptsCreated} highlight
                  {excelStep.result.excerptsCreated === 1 ? "" : "s"} imported.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
                {excelStep.result.unmappedIq.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Unmapped Interview Questions ({excelStep.result.unmappedIq.length})
                    </p>
                    <ul className="space-y-0.5">
                      {excelStep.result.unmappedIq.map((row, i) => (
                        <li key={i} className="text-destructive">
                          {row.document_name} — "{row.code_name}" under "{row.iq_label}" ({row.iq_text})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {excelStep.result.notFound.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Highlights not imported ({excelStep.result.notFound.length})
                    </p>
                    <ul className="space-y-0.5">
                      {excelStep.result.notFound.map((row, i) => (
                        <li key={i} className="text-destructive">
                          {row.document_name} — "{row.code_name}": {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {excelStep.result.failedCodes.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Codes that failed to create ({excelStep.result.failedCodes.length})
                    </p>
                    <ul className="space-y-0.5">
                      {excelStep.result.failedCodes.map((row, i) => (
                        <li key={i} className="text-destructive">
                          "{row.code_name}" under "{row.iq_label}": {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {excelStep.result.unmappedIq.length === 0 &&
                  excelStep.result.notFound.length === 0 &&
                  excelStep.result.failedCodes.length === 0 && (
                    <p className="text-muted-foreground">Every row imported cleanly.</p>
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
