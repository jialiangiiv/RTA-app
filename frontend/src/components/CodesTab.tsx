import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { codebooksApi, qualitativeCodesApi } from "../api/codebooks";
import { codebookVersionsApi } from "../api/codebookVersions";
import { Codebook, CodedExcerpt, Project, QualitativeCode, TranscriptSummary } from "../types/domain";
import { CodebookShareCard } from "./CodebookShareCard";
import { MergeCodesDialog } from "./MergeCodesDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { codeLabelClassName } from "../lib/codeLabel";

interface CodesTabProps {
  projectId: string;
  project: Project | null;
  ownCodebook: Codebook | null;
  versions: Codebook[];
  /** Already scoped to the active Interview Question unless showAllCodes — see ProjectWorkspace. */
  qualitativeCodes: QualitativeCode[];
  totalCodeCount: number;
  activeInterviewQuestionLabel: string | null;
  /** Distinct Interview Question ids each code has actually been used under, project-wide. */
  codeInterviewQuestionIds: Record<string, string[]>;
  interviewQuestionLabelById: Record<string, string>;
  showAllCodes: boolean;
  onToggleShowAllCodes: () => void;
  comparisonCodebooks: Codebook[];
  transcripts: TranscriptSummary[];
  codedExcerpts: CodedExcerpt[];
  onCodesChanged: () => void;
  onCodebooksChanged: () => void;
  onExcerptsChanged: () => void;
  onJumpToExcerpt: (excerptId: string) => void;
}

export function CodesTab({
  projectId,
  project,
  ownCodebook,
  versions,
  qualitativeCodes,
  totalCodeCount,
  activeInterviewQuestionLabel,
  codeInterviewQuestionIds,
  interviewQuestionLabelById,
  showAllCodes,
  onToggleShowAllCodes,
  comparisonCodebooks,
  transcripts,
  codedExcerpts,
  onCodesChanged,
  onCodebooksChanged,
  onExcerptsChanged,
  onJumpToExcerpt,
}: CodesTabProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [searchingCodeId, setSearchingCodeId] = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [codeNameSearch, setCodeNameSearch] = useState("");

  const visibleCodes = useMemo(() => {
    const sorted = [...qualitativeCodes].sort((a, b) => a.label.localeCompare(b.label));
    const query = codeNameSearch.trim().toLowerCase();
    return query ? sorted.filter((qc) => qc.label.toLowerCase().includes(query)) : sorted;
  }, [qualitativeCodes, codeNameSearch]);

  // Drop selections that no longer correspond to a visible code (e.g. after a filter change or refetch).
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(qualitativeCodes.map((qc) => qc.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [qualitativeCodes]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function excerptsForCode(codeId: string): CodedExcerpt[] {
    return codedExcerpts.filter((e) => e.qualitative_code_id === codeId);
  }

  function startSearch(codeId: string) {
    setSearchingCodeId(codeId);
    setSearchIndex(0);
    const matches = excerptsForCode(codeId);
    if (matches[0]) onJumpToExcerpt(matches[0].id);
  }

  function jump(codeId: string, delta: number) {
    const matches = excerptsForCode(codeId);
    if (matches.length === 0) return;
    const next = (searchIndex + delta + matches.length) % matches.length;
    setSearchIndex(next);
    onJumpToExcerpt(matches[next].id);
  }

  async function handleActivateVersion(codebookId: string) {
    await codebookVersionsApi.activate(projectId, codebookId);
    onCodebooksChanged();
  }

  async function handleCreateCode(e: FormEvent) {
    e.preventDefault();
    if (!ownCodebook || !newLabel.trim()) return;
    try {
      const created = await qualitativeCodesApi.create({
        codebook_id: ownCodebook.id,
        interview_question_id: null,
        label: newLabel.trim(),
        description: newDescription.trim() || newLabel.trim(),
        theme: null,
        example_quote: null,
        color: null,
      });
      setNewLabel("");
      setNewDescription("");
      onCodesChanged();
      if (created.reused) {
        window.alert(`A code named "${created.label}" already exists in this codebook — no duplicate was created.`);
      }
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  function startEdit(qc: QualitativeCode) {
    setEditingId(qc.id);
    setEditLabel(qc.label);
    setEditDescription(qc.description);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    try {
      await qualitativeCodesApi.update(editingId, { label: editLabel.trim(), description: editDescription.trim() });
      setEditingId(null);
      onCodesChanged();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-5 pt-4">
      {versions.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Codebook version</Label>
          <Select value={ownCodebook?.id ?? undefined} onValueChange={handleActivateVersion}>
            <SelectTrigger>
              <SelectValue placeholder="Select a version…" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {showAllCodes
            ? `Showing all ${totalCodeCount} code${totalCodeCount === 1 ? "" : "s"}`
            : `Showing ${qualitativeCodes.length} of ${totalCodeCount} code${totalCodeCount === 1 ? "" : "s"}${
                activeInterviewQuestionLabel ? ` — for ${activeInterviewQuestionLabel}` : ""
              }`}
        </p>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={onToggleShowAllCodes}>
          {showAllCodes ? "Show this IQ only" : "Show all codes"}
        </Button>
      </div>

      {selectedIds.size >= 2 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setMergeDialogOpen(true)}>
            Merge {selectedIds.size} codes
          </Button>
        </div>
      )}

      {qualitativeCodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showAllCodes
            ? "No codes yet — add one below, or highlight text to create one inline."
            : "No codes for this Interview Question yet — highlight text to create one, or switch to \"Show all codes\"."}
        </p>
      ) : (
        <>
          <Input
            value={codeNameSearch}
            onChange={(e) => setCodeNameSearch(e.target.value)}
            placeholder="Search codes by name"
            aria-label="Search codes by name"
          />
          {visibleCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No codes match &quot;{codeNameSearch.trim()}&quot;.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {visibleCodes.map((qc) =>
                editingId === qc.id ? (
                  <li key={qc.id} className="p-3">
                    <form className="space-y-2" onSubmit={handleSaveEdit}>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-label-${qc.id}`} className="text-xs text-muted-foreground">
                          Code name
                        </Label>
                        <Input id={`edit-label-${qc.id}`} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-desc-${qc.id}`} className="text-xs text-muted-foreground">
                          Definition
                        </Label>
                        <Textarea
                          id={`edit-desc-${qc.id}`}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li key={qc.id}>
                    <div className="flex items-center gap-1 pr-1">
                      <input
                        type="checkbox"
                        className="ml-3 h-4 w-4 shrink-0"
                        checked={selectedIds.has(qc.id)}
                        onChange={() => toggleSelected(qc.id)}
                        aria-label={`Select ${qc.label} to merge`}
                      />
                      <button
                        className="min-w-0 flex-1 px-3 py-2 text-left transition-colors hover:bg-accent"
                        onClick={() => startEdit(qc)}
                      >
                        <p className={codeLabelClassName(qc.label)} title={qc.label}>
                          <span className="mr-1.5 text-muted-foreground" aria-hidden="true">
                            •
                          </span>
                          {qc.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {qc.description || "No definition."}
                        </p>
                        {(codeInterviewQuestionIds[qc.id]?.length ?? 0) > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {codeInterviewQuestionIds[qc.id].map((iqId) => (
                              <span
                                key={iqId}
                                className="rounded-full border bg-accent/60 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
                              >
                                {interviewQuestionLabelById[iqId] ?? "Unknown IQ"}
                              </span>
                            ))}
                          </p>
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Find highlights of this code"
                        onClick={() => startSearch(qc.id)}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {searchingCodeId === qc.id &&
                      (() => {
                        const matches = excerptsForCode(qc.id);
                        return (
                          <div className="flex items-center justify-between gap-2 border-t bg-accent/40 px-3 py-1.5 text-xs">
                            {matches.length === 0 ? (
                              <span className="text-muted-foreground">No highlights in this transcript.</span>
                            ) : (
                              <>
                                <span className="text-muted-foreground">
                                  {searchIndex + 1} / {matches.length} in this transcript
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    title="Previous highlight"
                                    onClick={() => jump(qc.id, -1)}
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    title="Next highlight"
                                    onClick={() => jump(qc.id, 1)}
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Close"
                              onClick={() => setSearchingCodeId(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })()}
                  </li>
                )
              )}
            </ul>
          )}
        </>
      )}

      {comparisonCodebooks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imported for comparison</h4>
          <ul className="divide-y rounded-md border">
            {comparisonCodebooks.map((cb) => (
              <li key={cb.id} className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-sm font-medium">{cb.name}</span>
                <div className="flex shrink-0 gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <a href={codebooksApi.exportUrl(cb.id)}>Export</a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      await codebooksApi.remove(cb.id);
                      onCodebooksChanged();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      <form className="space-y-2" onSubmit={handleCreateCode}>
        <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Code label" />
        <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" />
        <Button type="submit" variant="outline" size="sm" className="w-full">
          Add Code
        </Button>
      </form>

      <Separator />

      <CodebookShareCard
        projectId={projectId}
        project={project}
        ownCodebookId={ownCodebook?.id ?? null}
        ownCodebookVersionLabel={ownCodebook?.version_label ?? null}
        transcripts={transcripts}
        onImported={() => {
          onCodesChanged();
          onExcerptsChanged();
        }}
      />

      <MergeCodesDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        candidates={qualitativeCodes.filter((qc) => selectedIds.has(qc.id))}
        onMerged={() => {
          setSelectedIds(new Set());
          setMergeDialogOpen(false);
          onCodesChanged();
          onExcerptsChanged();
        }}
      />
    </div>
  );
}
