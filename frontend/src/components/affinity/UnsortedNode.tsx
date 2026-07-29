import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ContainerNode } from "./ContainerNode";

export const UnsortedNode = memo(function UnsortedNode(props: NodeProps) {
  return <ContainerNode {...props} editable={false} deletable={false} showTags={false} accentClassName="border-dashed border-muted-foreground/40" />;
});
