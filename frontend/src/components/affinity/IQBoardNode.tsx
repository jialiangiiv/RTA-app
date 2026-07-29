import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ContainerNode } from "./ContainerNode";

export const IQBoardNode = memo(function IQBoardNode(props: NodeProps) {
  return <ContainerNode {...props} editable={false} deletable={false} showTags={false} accentClassName="border-brand/50" />;
});
