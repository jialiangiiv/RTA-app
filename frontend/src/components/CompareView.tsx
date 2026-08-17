import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { codebookVersionsApi, AcceptedCode, FinishResult } from "../api/codebookVersions";
import { codebookShareApi, CodebookShareBundle } from "../api/codebookShare";
import { qualitativeCodesApi } from "../api/codebooks";
import { codedExcerptsApi } from "../api/codedExcerpts";
import { comparisonSessionsApi } from "../api/comparisonSessions";
import { CodedExcerpt, QualitativeCode, Transcript } from "../types/domain";
import { TaggedTranscript, TranscriptTag } from "./TaggedTranscript";
import { CodeTrashDialog } from "./CodeTrashDialog";
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
  ownCodebookId: string | null;
  activeInterviewQuestionId: string | null;
  activeInterviewQuestionLabel: string | null;
  interviewQuestionLabelById: Record<string, string>;
  onExit: () => void;
  onFinished: () => void;
  onExcerptDeleted: () => void;
  onCodesChanged: () => void;
}

type EditTarget = { side: "left" | "right"; key: string; label: string; definition: string };

type Phase =
  | { kind: "checking-session" }
  | { kind: "import-prompt" }
  | { kind: "import-summary"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "comparing"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "finish-prompt"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "finishing"; bundle: CodebookShareBundle; ownerName: string }
  | { kind: "done"; result: FinishResult }
  | { kind: "error"; message: string; bundle: CodebookShareBundle; ownerName: string };

function keyOf(codeName: string): string {
  return codeName.trim().toLowerCase();
}

/** Stable per-occurrence identity for one imported highlight — independent of array index or
 *  which transcript happens to be active, so accept/reject state (and the "delete this highlight"
 *  dismissal set) never collides across transcripts or shifts when the list re-filters. */
function excerptKey(e: { code_name: string; transcript_file_name: string; start_offset: number; end_offset: number }): string {
  return `right-${keyOf(e.code_name)}|${e.transcript_file_name}|${e.start_offset}|${e.end_offset}`;
}

/** Sessions saved before Accept/Reject became per-highlight recorded a plain `keyOf(code_name)`
 *  per accepted CODE. Restoring one of those verbatim into the new per-excerpt keying would match
 *  nothing (silently unaccepting everything) — expand each legacy entry into every excerpt that
 *  code currently has, matching what "accepted" used to mean. */
function migrateAcceptedKeys(rawKeys: string[], bundle: CodebookShareBundle): Set<string> {
  const migrated = new Set<string>();
  for (const raw of rawKeys) {
    if (raw.startsWith("right-") && raw.includes("|")) {
      migrated.add(raw);
      continue;
    }
    for (const e of bundle.coded_excerpts) {
      if (keyOf(e.code_name) === raw) migrated.add(excerptKey(e));
    }
  }
  return migrated;
}

export function CompareView({
  projectId,
  currentUserDisplayName,
  activeTranscript,
  leftCodedExcerpts,
  leftQualitativeCodesById,
  highlightColor,
  ownCodebookId,
  activeInterviewQuestionId,
  activeInterviewQuestionLabel,
  interviewQuestionLabelById,
  onExit,
  onFinished,
  onExcerptDeleted,
  onCodesChanged,
}: CompareViewProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking-session" });
  const [importedOwnerName, setImportedOwnerName] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Accept/reject is per HIGHLIGHT (one specific occurrence), not per code — a code can be
  // legitimately accepted for one quote and rejected for another. Keyed by excerptKey(). Persisted
  // under the same "accepted_code_names" wire field as before (the backend treats it as an opaque
  // string array, so no schema change was needed) — it just holds excerpt keys now, not code names.
  const [acceptedExcerptKeys, setAcceptedExcerptKeys] = useState<Set<string>>(new Set());
  const [editedByCodeName, setEditedByCodeName] = useState<Record<string, { label: string; definition: string }>>({});
  // Session-only: right-margin (imported, not-yet-persisted) codes/occurrences the user has
  // dismissed. Never touches the backend — there's nothing in the DB to soft-delete pre-accept.
  const [excludedCodeNames, setExcludedCodeNames] = useState<Set<string>>(new Set());
  const [excludedRightKeys, setExcludedRightKeys] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [finishVersionLabel, setFinishVersionLabel] = useState("");
  const [finishOwnerName, setFinishOwnerName] = useState("");
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  // On entering Compare, check for a saved (half-finished) session before showing the import
  // prompt — lets a user resume exactly where they left off after navigating away mid-comparison.
  useEffect(() => {
    let cancelled = false;
    comparisonSessionsApi.get(projectId).then((session) => {
      if (cancelled) return;
      if (session) {
        setAcceptedExcerptKeys(migrateAcceptedKeys(session.accepted_code_names, session.bundle));
        setEditedByCodeName(session.edited_by_code_name);
        setExcludedCodeNames(new Set(session.excluded_code_names));
        setExcludedRightKeys(new Set(session.excluded_right_keys));
        setFinishOwnerName(`${currentUserDisplayName} + ${session.owner_name}`);
        setPhase({ kind: "comparing", bundle: session.bundle, ownerName: session.owner_name });
      } else {
        setPhase({ kind: "import-prompt" });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  async function trashLeftCode(codeId: string) {
    if (!window.confirm("Move this code — and all of its highlights — to Trash?")) return;
    try {
      await qualitativeCodesApi.remove(codeId);
      onCodesChanged();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  function toggleAccept(excerptTagKey: string) {
    setAcceptedExcerptKeys((prev) => {
      const next = new Set(prev);
      if (next.has(excerptTagKey)) next.delete(excerptTagKey);
      else next.add(excerptTagKey);
      return next;
    });
  }

  function excludeRightHighlight(tagKey: string) {
    setExcludedRightKeys((prev) => new Set(prev).add(tagKey));
    // A dismissed highlight is never merged, even if it was accepted first — don't leave it as a
    // stale "accepted" entry once it's no longer shown anywhere.
    setAcceptedExcerptKeys((prev) => {
      if (!prev.has(tagKey)) return prev;
      const next = new Set(prev);
      next.delete(tagKey);
      return next;
    });
  }

  function excludeRightCode(codeKey: string) {
    if (!window.confirm("Exclude this imported code (and all of its proposed highlights) from this comparison?")) return;
    setExcludedCodeNames((prev) => new Set(prev).add(codeKey));
    setAcceptedExcerptKeys((prev) => {
      const codePrefix = `right-${codeKey}|`;
      const next = new Set([...prev].filter((k) => !k.startsWith(codePrefix)));
      return next.size === prev.size ? prev : next;
    });
    setEditedByCodeName((prev) => {
      if (!(codeKey in prev)) return prev;
      const next = { ...prev };
      delete next[codeKey];
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
        onCodesChanged();
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

  async function persistSession(bundle: CodebookShareBundle) {
    await comparisonSessionsApi.save({
      project_id: projectId,
      owner_name: ownerName,
      bundle,
      accepted_code_names: Array.from(acceptedExcerptKeys),
      edited_by_code_name: editedByCodeName,
      excluded_code_names: Array.from(excludedCodeNames),
      excluded_right_keys: Array.from(excludedRightKeys),
    });
  }

  async function saveSession() {
    if (!bundle) return;
    try {
      await persistSession(bundle);
      onExit();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  async function submitFinish(bundle: CodebookShareBundle) {
    if (!finishVersionLabel.trim()) return;
    setPhase({ kind: "finishing", bundle, ownerName });
    try {
      // Checkpoint before the risky call: if the merge fails server-side, this comparison stays
      // resumable (via "Save & Exit"'s own restore-on-mount effect) instead of being unrecoverable.
      await persistSession(bundle);
      // acceptedByCode already holds exactly the accepted highlights, grouped by code — so this is
      // just a reshape into the wire format, not a re-filter.
      const accepted: AcceptedCode[] = Array.from(acceptedByCode.entries()).map(([key, { code, excerpts }]) => {
        const edited = editedByCodeName[key];
        return {
          code_name: edited?.label ?? code.code_name,
          code_definition: edited?.definition ?? code.code_definition,
          iq_label: code.iq_label,
          iq_text: code.iq_text,
          coded_excerpts: excerpts.map((e) => ({
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
      setPhase({ kind: "error", message: (err as Error).message, bundle, ownerName });
    }
  }

  const leftExcerptCodeId = useMemo(
    () => new Map(leftCodedExcerpts.map((e) => [e.id, e.qualitative_code_id])),
    [leftCodedExcerpts]
  );

  const filteredLeftExcerpts = useMemo(
    () =>
      showAllCodes || !activeInterviewQuestionId
        ? leftCodedExcerpts
        : leftCodedExcerpts.filter((e) => e.interview_question_id === activeInterviewQuestionId),
    [leftCodedExcerpts, showAllCodes, activeInterviewQuestionId]
  );

  const leftTags: TranscriptTag[] = useMemo(
    () =>
      filteredLeftExcerpts.map((e) => {
        const code = leftQualitativeCodesById[e.qualitative_code_id];
        return {
          key: e.id,
          start_offset: e.start_offset,
          end_offset: e.end_offset,
          label: code?.label ?? "code",
          definition: code?.description ?? "",
          iqLabel: interviewQuestionLabelById[e.interview_question_id],
        };
      }),
    [filteredLeftExcerpts, leftQualitativeCodesById, interviewQuestionLabelById]
  );

  const comparing =
    phase.kind === "comparing" ||
    phase.kind === "finish-prompt" ||
    phase.kind === "finishing" ||
    phase.kind === "done" ||
    phase.kind === "error";
  const bundle =
    phase.kind === "comparing" || phase.kind === "finish-prompt" || phase.kind === "finishing" || phase.kind === "error"
      ? phase.bundle
      : null;
  const ownerName =
    phase.kind === "comparing" || phase.kind === "finish-prompt" || phase.kind === "finishing" || phase.kind === "error"
      ? phase.ownerName
      : "";

  // Shared by rightTags (below) and acceptedByCode — both need "which bundle code does this
  // excerpt belong to" and there's no reason to rebuild that map twice.
  const bundleCodesByName = useMemo(
    () => new Map((bundle?.codes ?? []).map((c) => [keyOf(c.code_name), c])),
    [bundle]
  );

  // The accepted highlights (not whole codes — see toggleAccept), grouped back by code for the
  // Finish payload and for the "N codes / M highlights accepted" summary below.
  const acceptedByCode = useMemo(() => {
    const grouped = new Map<string, { code: CodebookShareBundle["codes"][number]; excerpts: CodebookShareBundle["coded_excerpts"] }>();
    for (const e of bundle?.coded_excerpts ?? []) {
      if (!acceptedExcerptKeys.has(excerptKey(e))) continue;
      const key = keyOf(e.code_name);
      const code = bundleCodesByName.get(key);
      if (!code) continue;
      if (!grouped.has(key)) grouped.set(key, { code, excerpts: [] });
      grouped.get(key)!.excerpts.push(e);
    }
    return grouped;
  }, [bundle, bundleCodesByName, acceptedExcerptKeys]);
  const acceptedHighlightCount = Array.from(acceptedByCode.values()).reduce((sum, v) => sum + v.excerpts.length, 0);

  const rightTags: TranscriptTag[] = useMemo(() => {
    if (!bundle) return [];
    return bundle.coded_excerpts
      .filter((e) => e.transcript_file_name === activeTranscript.file_name)
      .map((e) => {
        const key = keyOf(e.code_name);
        const tagKey = excerptKey(e);
        const info = bundleCodesByName.get(key);
        const edited = editedByCodeName[key];
        return {
          key: tagKey,
          start_offset: e.start_offset,
          end_offset: e.end_offset,
          label: edited?.label ?? info?.code_name ?? e.code_name,
          definition: edited?.definition ?? info?.code_definition ?? "",
          accepted: acceptedExcerptKeys.has(tagKey),
          codeKey: key,
          iqLabel: info?.iq_label,
        };
      })
      .filter((tag) => !excludedCodeNames.has(tag.codeKey!) && !excludedRightKeys.has(tag.key))
      .filter((tag) => showAllCodes || !activeInterviewQuestionLabel || tag.iqLabel === activeInterviewQuestionLabel);
  }, [
    bundle,
    bundleCodesByName,
    activeTranscript.file_name,
    editedByCodeName,
    acceptedExcerptKeys,
    excludedCodeNames,
    excludedRightKeys,
    showAllCodes,
    activeInterviewQuestionLabel,
  ]);

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
      {phase.kind === "checking-session" && (
        <div className="flex items-center justify-center gap-3 rounded-md border bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for a saved comparison…
        </div>
      )}

      {comparing && (
        <div className="flex items-center justify-between rounded-md border bg-card p-3">
          <div>
            <p className="text-sm font-medium">Comparing with {ownerName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAllCodes((v) => !v)}>
              {showAllCodes ? "Show this IQ only" : "Show all codes"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTrashOpen(true)}>
              Trash
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Saves your progress as a resumable draft and exits. Doesn't merge any codes yet."
              onClick={saveSession}
            >
              Save Draft &amp; Exit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Discards your accept/reject choices without saving them."
              onClick={() => {
                if (window.confirm("Discard your progress in this comparison? Use \"Save Draft & Exit\" instead if you want to keep it.")) {
                  onExit();
                }
              }}
            >
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
                <>
                  <Button size="sm" variant="outline" onClick={() => toggleAccept(tag.key)}>
                    Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => excludeRightHighlight(tag.key)}>
                    Delete this highlight
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => excludeRightCode(tag.codeKey!)}
                  >
                    Delete code
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditTarget({
                        side: "left",
                        key: leftExcerptCodeId.get(tag.key) ?? tag.key,
                        label: tag.label,
                        definition: tag.definition,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteLeftExcerpt(tag.key)}>
                    Delete this highlight
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const codeId = leftExcerptCodeId.get(tag.key);
                      if (codeId) trashLeftCode(codeId);
                    }}
                  >
                    Delete code
                  </Button>
                </>
              )
            }
            renderRightActions={(tag) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEditTarget({
                      side: "right",
                      key: tag.codeKey!,
                      label: tag.label,
                      definition: tag.definition,
                    })
                  }
                >
                  Edit
                </Button>
                <Button size="sm" onClick={() => toggleAccept(tag.key)}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => excludeRightHighlight(tag.key)}>
                  Delete this highlight
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => excludeRightCode(tag.codeKey!)}
                >
                  Delete code
                </Button>
              </>
            )}
          />
        </div>
      )}

      <CodeTrashDialog codebookId={ownCodebookId} open={trashOpen} onOpenChange={setTrashOpen} onRestored={onCodesChanged} />

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
              {acceptedHighlightCount} highlight{acceptedHighlightCount === 1 ? "" : "s"} accepted across{" "}
              {acceptedByCode.size} code{acceptedByCode.size === 1 ? "" : "s"}, plus everything already in your
              codebook.
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
                <DialogDescription className="text-destructive">
                  {phase.message} Your progress has been saved — you can fix the issue and try Finish again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button size="sm" onClick={() => bundle && setPhase({ kind: "comparing", bundle, ownerName })}>
                  Back to comparing
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
            <Button size="sm" disabled={!editTarget?.label.trim()} onClick={saveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
