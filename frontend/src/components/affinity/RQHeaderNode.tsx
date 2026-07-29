import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

/** Purely a visual label — not persisted, not draggable/selectable (see AffinityBoardView's
 *  synthetic 'rq_header' node generation, which recomputes its position every render from its
 *  IQ boards' current positions). Research Questions have no node representation of their own. */
export const RQHeaderNode = memo(function RQHeaderNode({ data }: NodeProps) {
  const label = (data as { label: string }).label;
  return (
    <div className="pointer-events-none select-none whitespace-nowrap font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  );
});
