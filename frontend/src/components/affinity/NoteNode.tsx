import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { FlowNodeData } from "./flowTypes";
import { useAffinityBoardActions } from "./boardContext";

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 48;

export const NoteNode = memo(function NoteNode({ data }: NodeProps) {
  const { affinityNode } = data as FlowNodeData;
  const { updateNode, removeNode } = useAffinityBoardActions();
  const [body, setBody] = useState(affinityNode.body ?? "");
  const fontSize = affinityNode.font_size ?? 14;

  function stepFontSize(delta: number) {
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta));
    updateNode(affinityNode.id, { font_size: next });
  }

  return (
    <div
      className="flex animate-fade-in flex-col rounded-md border bg-yellow-50 p-2 shadow-sm dark:bg-yellow-950/40"
      style={{ width: affinityNode.width ?? 220, height: affinityNode.height ?? 140 }}
    >
      <div className="mb-1 flex shrink-0 items-center justify-end gap-1">
        <button className="nodrag text-muted-foreground hover:text-brand" title="Smaller text" onClick={() => stepFontSize(-2)}>
          <Minus className="h-3 w-3" />
        </button>
        <button className="nodrag text-muted-foreground hover:text-brand" title="Larger text" onClick={() => stepFontSize(2)}>
          <Plus className="h-3 w-3" />
        </button>
        <button
          className="nodrag text-muted-foreground hover:text-destructive"
          title="Delete note"
          onClick={() => removeNode(affinityNode.id)}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <textarea
        className="nodrag nowheel min-h-0 flex-1 resize-none bg-transparent outline-none placeholder:text-muted-foreground"
        style={{ fontSize }}
        value={body}
        placeholder="Note…"
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => updateNode(affinityNode.id, { body })}
      />
    </div>
  );
});
