import { FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
import { Tag } from "../../types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  onCreate: (name: string, color: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const DEFAULT_COLOR = "#b0461d";

export function ManageTagsDialog({ open, onOpenChange, tags, onCreate, onRemove }: ManageTagsDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onCreate(name.trim(), color);
      setName("");
      setColor(DEFAULT_COLOR);
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
        </DialogHeader>
        <ul className="max-h-52 divide-y overflow-y-auto rounded-md border">
          {tags.length === 0 && <li className="p-3 text-sm text-muted-foreground">No tags yet.</li>}
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-2 p-2">
              <span className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: tag.color ?? undefined }} />
                {tag.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onRemove(tag.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <form className="flex animate-fade-in items-center gap-2" onSubmit={handleCreate}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High priority" />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-9 shrink-0 cursor-pointer rounded-md border"
            title="Tag color"
          />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
