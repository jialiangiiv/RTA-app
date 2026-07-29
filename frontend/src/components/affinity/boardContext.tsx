import { createContext, useContext } from "react";
import { AffinityNode, Tag } from "../../types/domain";

export interface AffinityBoardActions {
  tagsByNode: Map<string, Tag[]>;
  updateNode: (id: string, updates: Partial<AffinityNode>) => Promise<AffinityNode | undefined>;
  removeNode: (id: string) => Promise<void>;
  openTagPopover: (nodeId: string, anchor: { top: number; left: number }) => void;
}

export const AffinityBoardContext = createContext<AffinityBoardActions | null>(null);

export function useAffinityBoardActions(): AffinityBoardActions {
  const ctx = useContext(AffinityBoardContext);
  if (!ctx) throw new Error("useAffinityBoardActions must be used within an AffinityBoardContext provider");
  return ctx;
}
