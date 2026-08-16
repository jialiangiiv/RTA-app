import { useEffect, useState } from "react";
import { qualitativeCodesApi } from "../api/codebooks";
import { QualitativeCode } from "../types/domain";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface CodeTrashDialogProps {
  codebookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a restore (not a permanent delete) — the caller should refresh its own codes/excerpts lists. */
  onRestored: () => void;
}

/** Lists whole codes deleted via the Codes tab's or Compare's "Delete"/"Delete code" action
 *  (soft-deleted, not yet purged) so they can be restored — or, if truly unwanted, permanently deleted. */
export function CodeTrashDialog({ codebookId, open, onOpenChange, onRestored }: CodeTrashDialogProps) {
  const [trashed, setTrashed] = useState<QualitativeCode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !codebookId) return;
    setLoading(true);
    qualitativeCodesApi
      .listTrashed(codebookId)
      .then(setTrashed)
      .finally(() => setLoading(false));
  }, [open, codebookId]);

  async function restore(id: string) {
    try {
      await qualitativeCodesApi.restore(id);
      setTrashed((prev) => prev.filter((c) => c.id !== id));
      onRestored();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  async function purge(id: string) {
    if (!window.confirm("Permanently delete this code? This cannot be undone.")) return;
    try {
      await qualitativeCodesApi.purge(id);
      setTrashed((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trash</DialogTitle>
          <DialogDescription>Deleted codes stay here until you restore them or delete them permanently.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : trashed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Trash is empty.</p>
          ) : (
            trashed.map((code) => (
              <div key={code.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{code.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{code.description || "No definition."}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => restore(code.id)}>
                    Restore
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => purge(code.id)}>
                    Delete permanently
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
