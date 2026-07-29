import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ContainerNode } from "./ContainerNode";

export const SectionNode = memo(function SectionNode(props: NodeProps) {
  return <ContainerNode {...props} editable deletable showTags accentClassName="border-border" />;
});
