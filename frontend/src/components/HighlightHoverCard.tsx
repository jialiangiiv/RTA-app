import { useEffect, useState } from "react";
import { QualitativeCode } from "../types/domain";
import { AnchorRect, useAnchoredPosition } from "../hooks/useAnchoredPosition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface HighlightHoverCardProps {
  anchor: AnchorRect;
  qCode: QualitativeCode | undefined;
  memo: string | null;
  onSave: (updates: { label: string; description: string }) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Replaces the native `title` tooltip on a highlighted excerpt — appears instantly on hover
 * (mouseenter/mouseleave only, never mousemove, so it costs nothing while the pointer travels),
 * and lets the user edit the code's name/definition or delete just this excerpt without ever
 * touching its stored offsets or interrupting a text-selection drag elsewhere in the transcript.
 * Flips above the highlight when there isn't enough viewport space below it.
 */
export function HighlightHoverCard({
  anchor,
  qCode,
  memo,
  onSave,
  onDelete,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: HighlightHoverCardProps) {
  const { ref, top } = useAnchoredPosition<HTMLDivElement>(anchor);
  const [label, setLabel] = useState(qCode?.label ?? "");
  const [description, setDescription] = useState(qCode?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(onClose, 700);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await onSave({ label: label.trim(), description: description.trim() });
      setSaved(true);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={ref}
      className="fixed z-[901] w-72 animate-fade-in space-y-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
      style={{ top, left: anchor.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {saved ? (
        <p className="animate-fade-in py-2 text-center text-sm font-medium text-brand">Saved ✓</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-sm font-medium"
              placeholder="Code name"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="Code definition"
            />
          </div>
          {memo && <p className="text-xs text-muted-foreground">Memo: {memo}</p>}
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={saving || !label.trim()} onClick={handleSave}>
              Save &amp; Apply
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
