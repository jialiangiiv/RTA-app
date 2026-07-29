import { FormEvent, useState } from "react";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { codebooksApi, qualitativeCodesApi } from "../api/codebooks";
import { codebookVersionsApi } from "../api/codebookVersions";
import { Codebook, CodedExcerpt, Project, QualitativeCode, TranscriptSummary } from "../types/domain";
import { CodebookShareCard } from "./CodebookShareCard";
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
  qualitativeCodes: QualitativeCode[];
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
      await qualitativeCodesApi.create({
        codebook_id: ownCodebook.id,
        label: newLabel.trim(),
        description: newDescription.trim() || newLabel.trim(),
        theme: null,
        example_quote: null,
        color: null,
      });
      setNewLabel("");
      setNewDescription("");
      onCodesChanged();
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

      {qualitativeCodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No codes yet — add one below, or highlight text to create one inline.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {qualitativeCodes.map((qc) =>
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
    </div>
  );
}
