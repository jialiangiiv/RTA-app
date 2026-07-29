import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ContainerNode } from "./ContainerNode";

export const ThemeNode = memo(function ThemeNode(props: NodeProps) {
  return <ContainerNode {...props} editable deletable showTags accentClassName="border-muted-foreground/30" />;
});
