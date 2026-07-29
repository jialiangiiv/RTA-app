import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Trash2, Tag as TagIcon } from "lucide-react";
import { FlowNodeData } from "./flowTypes";
import { useAffinityBoardActions } from "./boardContext";
import { TagChips } from "./TagChips";
import { Input } from "@/components/ui/input";

interface ContainerNodeProps extends NodeProps {
  editable: boolean;
  deletable: boolean;
  showTags: boolean;
  accentClassName: string;
}

/** Shared visual shell for every container node type (RQ lane, Section, Theme, Unsorted) — a
 *  bordered box sized from the AffinityNode's width/height, with a header label and (for
 *  user-created Section/Theme nodes) inline rename + delete. Child nodes render on top via
 *  React Flow's own parentNode positioning, not as DOM children of this component. */
export function ContainerNode({ id, data, editable, deletable, showTags, accentClassName }: ContainerNodeProps) {
  const { affinityNode, displayLabel, displaySubtitle } = data as FlowNodeData;
  const { tagsByNode, updateNode, removeNode, openTagPopover } = useAffinityBoardActions();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(displayLabel);
  const tags = tagsByNode.get(id) ?? [];

  async function saveLabel() {
    setEditing(false);
    if (label.trim() && label.trim() !== displayLabel) {
      await updateNode(affinityNode.id, { label: label.trim() });
    } else {
      setLabel(displayLabel);
    }
  }

  return (
    <div
      className={`flex h-full w-full flex-col rounded-lg border-2 bg-card/60 ${accentClassName}`}
      style={{ width: affinityNode.width ?? 300, height: affinityNode.height ?? 200 }}
    >
      <div className="flex shrink-0 items-center justify-between gap-1 border-b bg-card px-2 py-1.5">
        {editing ? (
          <Input
            autoFocus
            className="nodrag h-6 flex-1 text-xs"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => e.key === "Enter" && saveLabel()}
          />
        ) : (
          <button
            className="nodrag min-w-0 flex-1 truncate text-left text-xs font-display font-semibold"
            disabled={!editable}
            onClick={() => editable && setEditing(true)}
            title={displaySubtitle || displayLabel}
          >
            {displayLabel}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {showTags && (
            <button
              className="nodrag text-muted-foreground hover:text-brand"
              title="Tags"
              onClick={(e) => {
                e.stopPropagation();
                openTagPopover(affinityNode.id, { top: e.clientY, left: e.clientX });
              }}
            >
              <TagIcon className="h-3 w-3" />
            </button>
          )}
          {deletable && (
            <button
              className="nodrag text-muted-foreground hover:text-destructive"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${displayLabel}"? Its contents become unsorted/top-level.`)) {
                  removeNode(affinityNode.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {displaySubtitle && !editing && (
        <p className="shrink-0 px-2 pt-1 text-[11px] text-muted-foreground line-clamp-2">{displaySubtitle}</p>
      )}
      {showTags && <div className="shrink-0 px-2">{tags.length > 0 && <TagChips tags={tags} />}</div>}
      <div className="relative flex-1" />
    </div>
  );
}
