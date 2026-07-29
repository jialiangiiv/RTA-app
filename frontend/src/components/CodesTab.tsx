import { FormEvent, useState } from "react";
import { codebooksApi, qualitativeCodesApi } from "../api/codebooks";
import { codebookVersionsApi } from "../api/codebookVersions";
import { Codebook, Project, QualitativeCode, Transcript } from "../types/domain";
import { CodebookShareCard } from "./CodebookShareCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface CodesTabProps {
  projectId: string;
  project: Project | null;
  ownCodebook: Codebook | null;
  versions: Codebook[];
  qualitativeCodes: QualitativeCode[];
  comparisonCodebooks: Codebook[];
  transcripts: Transcript[];
  onCodesChanged: () => void;
  onCodebooksChanged: () => void;
  onExcerptsChanged: () => void;
}

export function CodesTab({
  projectId,
  project,
  ownCodebook,
  versions,
  qualitativeCodes,
  comparisonCodebooks,
  transcripts,
  onCodesChanged,
  onCodebooksChanged,
  onExcerptsChanged,
}: CodesTabProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");

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
        <ul className="space-y-1 rounded-md border p-1">
          {qualitativeCodes.map((qc) =>
            editingId === qc.id ? (
              <li key={qc.id}>
                <form className="space-y-2 p-2" onSubmit={handleSaveEdit}>
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
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
                <button
                  className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => startEdit(qc)}
                  title={qc.description}
                >
                  {qc.label}
                </button>
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
        transcripts={transcripts}
        onImported={() => {
          onCodesChanged();
          onExcerptsChanged();
        }}
      />
    </div>
  );
}
