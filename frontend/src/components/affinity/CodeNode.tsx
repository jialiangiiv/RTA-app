import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Tag as TagIcon } from "lucide-react";
import { FlowNodeData } from "./flowTypes";
import { useAffinityBoardActions } from "./boardContext";
import { TagChips } from "./TagChips";

export const CodeNode = memo(function CodeNode({ id, data }: NodeProps) {
  const { affinityNode, displayLabel, displaySubtitle } = data as FlowNodeData;
  const { tagsByNode, openTagPopover } = useAffinityBoardActions();
  const tags = tagsByNode.get(id) ?? [];

  return (
    <div className="w-40 animate-fade-in rounded-md border bg-card p-2 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">
          <span className="mr-1 text-muted-foreground" aria-hidden="true">
            •
          </span>
          {displayLabel}
        </p>
        <button
          className="nodrag shrink-0 text-muted-foreground hover:text-brand"
          title="Tags"
          onClick={(e) => {
            e.stopPropagation();
            openTagPopover(affinityNode.id, { top: e.clientY, left: e.clientX });
          }}
        >
          <TagIcon className="h-3 w-3" />
        </button>
      </div>
      {displaySubtitle && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{displaySubtitle}</p>}
      <TagChips tags={tags} />
    </div>
  );
});
