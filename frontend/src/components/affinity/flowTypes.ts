import type { Node } from "@xyflow/react";
import { AffinityNode } from "../../types/domain";

export type FlowNodeData = {
  affinityNode: AffinityNode;
  displayLabel: string;
  displaySubtitle: string;
} & Record<string, unknown>;

export type AffinityFlowNode = Node<FlowNodeData>;
