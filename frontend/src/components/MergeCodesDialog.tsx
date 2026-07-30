import { useEffect, useState } from "react";
import { qualitativeCodesApi } from "../api/codebooks";
import { QualitativeCode } from "../types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface MergeCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: QualitativeCode[];
  onMerged: () => void;
}

/** Consolidates 2+ duplicate codes into one: pick which survives (label/definition editable),
 *  every highlight from the others is repointed to it, and the others are permanently deleted. */
export function MergeCodesDialog({ open, onOpenChange, candidates, onMerged }: MergeCodesDialogProps) {
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = candidates[0];
    setTargetId(first?.id ?? "");
    setLabel(first?.label ?? "");
    setDescription(first?.description ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickTarget(id: string) {
    setTargetId(id);
    const chosen = candidates.find((c) => c.id === id);
    if (chosen) {
      setLabel(chosen.label);
      setDescription(chosen.description);
    }
  }

  async function submit() {
    if (!targetId) return;
    setError(null);
    try {
      await qualitativeCodesApi.merge({
        sourceIds: candidates.filter((c) => c.id !== targetId).map((c) => c.id),
        targetId,
        label: label.trim(),
        description: description.trim(),
      });
      onMerged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge {candidates.length} codes</DialogTitle>
          <DialogDescription>
            All highlights from the other codes move to the one you keep; the rest are deleted. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Keep</Label>
            <div className="space-y-1 rounded-md border p-2">
              {candidates.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="merge-target" checked={targetId === c.id} onChange={() => pickTarget(c.id)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="merge-label">Label</Label>
            <Input id="merge-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="merge-description">Definition</Label>
            <Textarea id="merge-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!targetId}>
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
