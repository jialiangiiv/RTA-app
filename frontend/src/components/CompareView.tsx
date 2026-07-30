import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { codebookVersionsApi, AcceptedCode, FinishResult } from "../api/codebookVersions";
import { codebookShareApi, CodebookShareBundle } from "../api/codebookShare";
import { qualitativeCodesApi } from "../api/codebooks";
import { codedExcerptsApi } from "../api/codedExcerpts";
import { CodedExcerpt, QualitativeCode, Transcript } from "../types/domain";
import { TaggedTranscript, TranscriptTag } from "./TaggedTranscript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface CompareViewProps {
  projectId: string;
  currentUserDisplayName: string;
  activeTranscript: Transcript;
  leftCodedExcerpts: CodedExcerpt[];
  leftQualitativeCodesById: Record<string, QualitativeCode>;
  highlightColor: string;
  onExit: () => void;
  onFinished: () => void;
  onExcerptDeleted: () => void;
}

type EditTarget = { side: "left" | "right"; key: string; label: string; definition: string };

type Phase =
  | { kind: "import-prompt" }
  | { kind: "import-summary"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "comparing"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "finish-prompt"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "finishing" }
  | { kind: "done"; result: FinishResult }
  | { kind: "error"; message: string };

function keyOf(codeName: string): string {
  return codeName.trim().toLowerCase();
}

export function CompareView({
  projectId,
  currentUserDisplayName,
  activeTranscript,
  leftCodedExcerpts,
  leftQualitativeCodesById,
  highlightColor,
  onExit,
  onFinished,
  onExcerptDeleted,
}: CompareViewProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "import-prompt" });
  const [importedOwnerName, setImportedOwnerName] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [acceptedCodeNames, setAcceptedCodeNames] = useState<Set<string>>(new Set());
  const [editedByCodeName, setEditedByCodeName] = useState<Record<string, { label: string; definition: string }>>({});
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [finishVersionLabel, setFinishVersionLabel] = useState("");
  const [finishOwnerName, setFinishOwnerName] = useState("");

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  }

  async function submitImport() {
    if (!pendingFile || !importedOwnerName.trim()) return;
    setImportError(null);
    try {
      const bundle = await codebookShareApi.parseFile(pendingFile);
      setPhase({ kind: "import-summary", bundle, ownerName: importedOwnerName.trim() });
      setFinishOwnerName(`${currentUserDisplayName} + ${importedOwnerName.trim()}`);
    } catch {
      setImportError("Couldn't read that file — is it a Codebook Share export (.json)?");
    }
  }

  function excerptCountsByTranscript(bundle: CodebookShareBundle): Array<{ file_name: string; count: number }> {
    const counts = new Map<string, number>();
    for (const excerpt of bundle.coded_excerpts) {
      counts.set(excerpt.transcript_file_name, (counts.get(excerpt.transcript_file_name) ?? 0) + 1);
    }
    return Array.from(counts, ([file_name, count]) => ({ file_name, count }));
  }

  async function deleteLeftExcerpt(excerptId: string) {
    try {
      await codedExcerptsApi.remove(excerptId);
      onExcerptDeleted();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  function toggleAccept(codeName: string) {
    setAcceptedCodeNames((prev) => {
      const next = new Set(prev);
      const key = keyOf(codeName);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (editTarget.side === "left") {
      try {
        await qualitativeCodesApi.update(editTarget.key, {
          label: editTarget.label.trim(),
          description: editTarget.definition.trim(),
        });
      } catch (err) {
        window.alert((err as Error).message);
        return;
      }
    } else {
      setEditedByCodeName((prev) => ({
        ...prev,
        [editTarget.key]: { label: editTarget.label.trim(), definition: editTarget.definition.trim() },
      }));
    }
    setEditTarget(null);
  }

  async function submitFinish(bundle: CodebookShareBundle) {
    if (!finishVersionLabel.trim()) return;
    setPhase({ kind: "finishing" });
    try {
      const accepted: AcceptedCode[] = bundle.codes
        .filter((c) => acceptedCodeNames.has(keyOf(c.code_name)))
        .map((c) => {
          const key = keyOf(c.code_name);
          const edited = editedByCodeName[key];
          return {
            code_name: edited?.label ?? c.code_name,
            code_definition: edited?.definition ?? c.code_definition,
            iq_label: c.iq_label,
            iq_text: c.iq_text,
            coded_excerpts: bundle.coded_excerpts
              .filter((e) => keyOf(e.code_name) === key)
              .map((e) => ({
                transcript_file_name: e.transcript_file_name,
                start_offset: e.start_offset,
                end_offset: e.end_offset,
              })),
          };
        });

      const result = await codebookVersionsApi.finish(projectId, {
        version_label: finishVersionLabel.trim(),
        owner_name: finishOwnerName.trim(),
        accepted,
      });
      setPhase({ kind: "done", result });
      onFinished();
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error).message });
    }
  }

  const leftTags: TranscriptTag[] = useMemo(
    () =>
      leftCodedExcerpts.map((e) => {
        const code = leftQualitativeCodesById[e.qualitative_code_id];
        return {
          key: e.id,
          start_offset: e.start_offset,
          end_offset: e.end_offset,
          label: code?.label ?? "code",
          definition: code?.description ?? "",
        };
      }),
    [leftCodedExcerpts, leftQualitativeCodesById]
  );

  const comparing = phase.kind === "comparing" || phase.kind === "finish-prompt";
  const bundle = phase.kind === "comparing" || phase.kind === "finish-prompt" ? phase.bundle : null;
  const ownerName = phase.kind === "comparing" || phase.kind === "finish-prompt" ? phase.ownerName : "";

  const rightTags: TranscriptTag[] = useMemo(() => {
    if (!bundle) return [];
    const codesByName = new Map(bundle.codes.map((c) => [keyOf(c.code_name), c]));
    return bundle.coded_excerpts
      .filter((e) => e.transcript_file_name === activeTranscript.file_name)
      .map((e, i) => {
        const key = keyOf(e.code_name);
        const info = codesByName.get(key);
        const edited = editedByCodeName[key];
        return {
          key: `right-${i}-${e.start_offset}-${e.end_offset}`,
          start_offset: e.start_offset,
          end_offset: e.end_offset,
          label: edited?.label ?? info?.code_name ?? e.code_name,
          definition: edited?.definition ?? info?.code_definition ?? "",
          accepted: acceptedCodeNames.has(key),
        };
      });
  }, [bundle, activeTranscript.file_name, editedByCodeName, acceptedCodeNames]);

  // Once a right-side (imported) tag is accepted, it moves out of the "Imported codes" column and
  // into "Your codes" alongside your own excerpts — shown in a third color so it's still visible
  // which ones came from the import. `key` for these keeps its "right-" prefix (see rightTags
  // above), which is how renderLeftActions/leftTagClassName below tell them apart from real
  // CodedExcerpts (which use the excerpt's own id and support Edit/Delete instead).
  const acceptedImportTags = rightTags.filter((t) => t.accepted);
  const unacceptedRightTags = rightTags.filter((t) => !t.accepted);
  const combinedLeftTags = [...leftTags, ...acceptedImportTags];

  return (
    <div className="space-y-4">
      {comparing && (
        <div className="flex items-center justify-between rounded-md border bg-card p-3">
          <div>
            <p className="text-sm font-medium">Comparing with {ownerName}</p>
            <p className="text-xs text-muted-foreground">
              Left: your codes. Right: hover a tag to preview, then accept the ones you want — accepted tags move to
              the left in green.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onExit}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => bundle && setPhase({ kind: "finish-prompt", bundle, ownerName })}>
              Finish Comparing
            </Button>
          </div>
        </div>
      )}

      {comparing && (
        <div className="rounded-md border bg-card p-4">
          <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Your codes</span>
            <span>Imported codes</span>
          </div>
          <TaggedTranscript
            rawText={activeTranscript.raw_text}
            leftTags={combinedLeftTags}
            rightTags={unacceptedRightTags}
            leftTagClassName={(tag) =>
              tag.key.startsWith("right-")
                ? "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "border-border bg-muted hover:bg-accent"
            }
            rightTagClassName="border-brand/40 bg-brand/10 hover:bg-brand/20"
            highlightColor={highlightColor}
            renderLeftActions={(tag) =>
              tag.key.startsWith("right-") ? (
                <Button size="sm" variant="outline" onClick={() => toggleAccept(tag.label)}>
                  Reject
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditTarget({ side: "left", key: tag.key, label: tag.label, definition: tag.definition })}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteLeftExcerpt(tag.key)}>
                    Delete
                  </Button>
                </>
              )
            }
            renderRightActions={(tag) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditTarget({ side: "right", key: keyOf(tag.label), label: tag.label, definition: tag.definition })}
                >
                  Edit
                </Button>
                <Button size="sm" onClick={() => toggleAccept(tag.label)}>
                  Accept
                </Button>
              </>
            )}
          />
        </div>
      )}

      <Dialog open={phase.kind === "import-prompt"} onOpenChange={(open) => !open && onExit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import a codebook to compare</DialogTitle>
            <DialogDescription>Pick their exported Codebook (.json) and name who it belongs to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input ref={fileRef} type="file" accept=".json" onChange={handlePickFile} className="hidden" />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
              {pendingFile ? pendingFile.name : "Choose .json file"}
            </Button>
            <div className="space-y-1">
              <Label htmlFor="import-owner">Codebook owner's name</Label>
              <Input id="import-owner" value={importedOwnerName} onChange={(e) => setImportedOwnerName(e.target.value)} placeholder="e.g. Alice" />
            </div>
            {importError && <p className="text-xs text-destructive">{importError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onExit}>
              Cancel
            </Button>
            <Button size="sm" disabled={!pendingFile || !importedOwnerName.trim()} onClick={submitImport}>
              Start Comparing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phase.kind === "import-summary"} onOpenChange={(open) => !open && onExit()}>
        <DialogContent>
          {phase.kind === "import-summary" && (
            <>
              <DialogHeader>
                <DialogTitle>Codebook imported</DialogTitle>
                <DialogDescription>
                  {phase.bundle.codes.length} code{phase.bundle.codes.length === 1 ? "" : "s"} imported from{" "}
                  {phase.ownerName} ({phase.bundle.project.name}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                {excerptCountsByTranscript(phase.bundle).length === 0 ? (
                  <p className="text-muted-foreground">No highlighted excerpts in this codebook.</p>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Excerpts by transcript</p>
                    <ul className="space-y-0.5">
                      {excerptCountsByTranscript(phase.bundle).map((t) => (
                        <li key={t.file_name}>
                          {t.file_name}: {t.count} excerpt{t.count === 1 ? "" : "s"}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={onExit}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPhase({ kind: "comparing", bundle: phase.bundle, ownerName: phase.ownerName })}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={phase.kind === "finish-prompt"} onOpenChange={(open) => !open && bundle && setPhase({ kind: "comparing", bundle, ownerName })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this merged codebook version</DialogTitle>
            <DialogDescription>
              {acceptedCodeNames.size} code{acceptedCodeNames.size === 1 ? "" : "s"} accepted, plus everything already in
              your codebook.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="finish-version">Version</Label>
              <Input id="finish-version" value={finishVersionLabel} onChange={(e) => setFinishVersionLabel(e.target.value)} placeholder="e.g. v2" autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="finish-owner">Owner</Label>
              <Input id="finish-owner" value={finishOwnerName} onChange={(e) => setFinishOwnerName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => bundle && setPhase({ kind: "comparing", bundle, ownerName })}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={!finishVersionLabel.trim()}
              onClick={() => bundle && submitFinish(bundle)}
            >
              Finish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phase.kind === "finishing" || phase.kind === "done" || phase.kind === "error"} onOpenChange={() => {}}>
        <DialogContent>
          {phase.kind === "finishing" && (
            <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Merging codebooks…
            </div>
          )}
          {phase.kind === "done" && (
            <>
              <DialogHeader>
                <DialogTitle>Comparison complete</DialogTitle>
                <DialogDescription>
                  Merged {phase.result.codesAccepted} code{phase.result.codesAccepted === 1 ? "" : "s"} into your codebook.
                  This is now your active codebook version.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                {phase.result.excerptsByTranscript.length === 0 ? (
                  <p className="text-muted-foreground">
                    No new excerpts highlighted{phase.result.excerptsSkipped > 0 ? ` (${phase.result.excerptsSkipped} skipped).` : "."}
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Excerpts highlighted</p>
                    <ul className="space-y-0.5">
                      {phase.result.excerptsByTranscript.map((t) => (
                        <li key={t.file_name}>
                          {t.file_name}: {t.count} excerpt{t.count === 1 ? "" : "s"}
                        </li>
                      ))}
                    </ul>
                    {phase.result.excerptsSkipped > 0 && (
                      <p className="text-xs text-muted-foreground">{phase.result.excerptsSkipped} skipped (not found locally).</p>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button size="sm" onClick={onExit}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
          {phase.kind === "error" && (
            <>
              <DialogHeader>
                <DialogTitle>Something went wrong</DialogTitle>
                <DialogDescription className="text-destructive">{phase.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button size="sm" onClick={onExit}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit code</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-code-label">Label</Label>
                <Input id="edit-code-label" value={editTarget.label} onChange={(e) => setEditTarget({ ...editTarget, label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-code-definition">Definition</Label>
                <Textarea
                  id="edit-code-definition"
                  value={editTarget.definition}
                  onChange={(e) => setEditTarget({ ...editTarget, definition: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
