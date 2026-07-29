import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  Background,
  Controls,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAffinityBoard } from "../hooks/useAffinityBoard";
import { qualitativeCodesApi } from "../api/codebooks";
import { researchQuestionsApi } from "../api/researchQuestions";
import { projectsApi } from "../api/projects";
import { tagsApi } from "../api/tags";
import { AffinityNode, AffinityNodeType, QualitativeCode, ResearchQuestion, Tag } from "../types/domain";
import { AffinityBoardContext } from "../components/affinity/boardContext";
import { FlowNodeData } from "../components/affinity/flowTypes";
import { RQLaneNode } from "../components/affinity/RQLaneNode";
import { SectionNode } from "../components/affinity/SectionNode";
import { ThemeNode } from "../components/affinity/ThemeNode";
import { CodeNode } from "../components/affinity/CodeNode";
import { NoteNode } from "../components/affinity/NoteNode";
import { UnsortedNode } from "../components/affinity/UnsortedNode";
import { AffinityBoardToolbar } from "../components/affinity/AffinityBoardToolbar";
import { AffinityTagPopover } from "../components/affinity/AffinityTagPopover";
import { ManageTagsDialog } from "../components/affinity/ManageTagsDialog";
import { Button } from "@/components/ui/button";

/** Defined once outside the component — a fresh object per render would force React Flow to
 *  remount every custom node component (see React Flow's own performance guidance). */
const NODE_TYPES = {
  rq_lane: RQLaneNode,
  section: SectionNode,
  theme: ThemeNode,
  code: CodeNode,
  note: NoteNode,
  unsorted: UnsortedNode,
};

/** Code (>) Theme (>) Section (>) RQ lane — enforced one level at a time; Notes/RQ lanes/Unsorted
 *  never nest into anything. */
const ALLOWED_PARENTS: Partial<Record<AffinityNodeType, AffinityNodeType[]>> = {
  code: ["theme", "unsorted"],
  theme: ["section"],
  section: ["rq_lane"],
};

function depthOf(node: AffinityNode, byId: Map<string, AffinityNode>): number {
  let depth = 0;
  let current = node;
  while (current.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    current = parent;
    depth++;
  }
  return depth;
}

function AffinityBoardCanvas({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const board = useAffinityBoard(projectId);
  const [codesById, setCodesById] = useState<Map<string, QualitativeCode>>(new Map());
  const [rqsById, setRqsById] = useState<Map<string, ResearchQuestion>>(new Map());
  const [projectName, setProjectName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [tagPopover, setTagPopover] = useState<{ nodeId: string; top: number; left: number } | null>(null);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();

  useEffect(() => {
    (async () => {
      const project = await projectsApi.get(projectId);
      setProjectName(project.name);
      const rqs = await researchQuestionsApi.listByProject(projectId);
      setRqsById(new Map(rqs.map((rq) => [rq.id, rq])));
      if (project.active_codebook_id) {
        const codes = await qualitativeCodesApi.listByCodebook(project.active_codebook_id);
        setCodesById(new Map(codes.map((c) => [c.id, c])));
      }
    })();
  }, [projectId]);

  const affinityNodesById = useMemo(() => new Map(board.nodes.map((n) => [n.id, n])), [board.nodes]);

  const tagsById = useMemo(() => new Map(board.tags.map((t) => [t.id, t])), [board.tags]);
  const tagsByNode = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const a of board.assignments) {
      const tag = tagsById.get(a.tag_id);
      if (!tag) continue;
      const list = map.get(a.affinity_node_id) ?? [];
      list.push(tag);
      map.set(a.affinity_node_id, list);
    }
    return map;
  }, [board.assignments, tagsById]);

  useEffect(() => {
    if (board.loading || board.nodes.length === 0) return;
    const sorted = [...board.nodes].sort((a, b) => depthOf(a, affinityNodesById) - depthOf(b, affinityNodesById));
    const flowNodes: Node<FlowNodeData>[] = sorted.map((n) => {
      const parent = n.parent_id ? affinityNodesById.get(n.parent_id) : undefined;
      const position = parent ? { x: n.pos_x - parent.pos_x, y: n.pos_y - parent.pos_y } : { x: n.pos_x, y: n.pos_y };

      let displayLabel = n.label ?? "";
      let displaySubtitle = "";
      if (n.node_type === "code" && n.ref_id) {
        const code = codesById.get(n.ref_id);
        displayLabel = code?.label ?? "(deleted code)";
        displaySubtitle = code?.description ?? "";
      } else if (n.node_type === "rq_lane" && n.ref_id) {
        const rq = rqsById.get(n.ref_id);
        displayLabel = rq?.label ?? "(deleted RQ)";
        displaySubtitle = rq?.text ?? "";
      } else if (n.node_type === "unsorted") {
        displayLabel = n.label ?? "Unsorted";
      } else if (n.node_type === "note") {
        displayLabel = "Note";
      }

      return {
        id: n.id,
        type: n.node_type,
        position,
        parentId: n.parent_id ?? undefined,
        // No `extent: "parent"` here: these nodes need to be draggable OUT of their current
        // parent (code -> theme, theme -> section, section -> rq_lane) so onNodeDragStop's
        // intersection check can re-parent them. React Flow's "parent" extent would clamp the
        // dragged node's position to stay fully inside its *current* parent's box, which makes
        // it physically impossible to ever reach a different container.
        draggable: true,
        style: n.node_type === "code" ? undefined : { width: n.width ?? undefined, height: n.height ?? undefined },
        data: { affinityNode: n, displayLabel, displaySubtitle },
      };
    });
    setNodes(flowNodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.nodes, board.loading, codesById, rqsById]);

  const handleNodeDragStop: OnNodeDrag<Node<FlowNodeData>> = async (_event, draggedNode) => {
    const affinityNode = affinityNodesById.get(draggedNode.id);
    if (!affinityNode) return;

    const oldParent = affinityNode.parent_id ? affinityNodesById.get(affinityNode.parent_id) : undefined;
    const absX = oldParent ? oldParent.pos_x + draggedNode.position.x : draggedNode.position.x;
    const absY = oldParent ? oldParent.pos_y + draggedNode.position.y : draggedNode.position.y;

    const allowed = ALLOWED_PARENTS[affinityNode.node_type] ?? [];
    let newParent: AffinityNode | undefined;
    if (allowed.length > 0) {
      const intersecting = getIntersectingNodes(draggedNode);
      const candidates = intersecting
        .map((n) => affinityNodesById.get(n.id))
        .filter((n): n is AffinityNode => !!n && n.id !== affinityNode.id && allowed.includes(n.node_type))
        .sort((a, b) => (a.width ?? Infinity) * (a.height ?? Infinity) - (b.width ?? Infinity) * (b.height ?? Infinity));
      newParent = candidates[0];
    }

    const updates: Partial<AffinityNode> = { pos_x: absX, pos_y: absY };
    if ((newParent?.id ?? null) !== affinityNode.parent_id) {
      updates.parent_id = newParent?.id ?? null;
    }
    await board.updateNode(affinityNode.id, updates);

    // pos_x/pos_y are stored as absolute canvas coordinates, and a descendant's on-screen
    // position is always `descendant.pos_x - parent.pos_x` (see the flowNodes map above). So
    // when a container that already has nested children is dragged, those children's stored
    // absolute positions must move by the same delta too — otherwise they keep rendering at
    // their old absolute spot next render, i.e. they visually fall out of the container even
    // though parent_id still (correctly) points at it.
    const deltaX = absX - affinityNode.pos_x;
    const deltaY = absY - affinityNode.pos_y;
    if (deltaX !== 0 || deltaY !== 0) {
      const isDescendant = (node: AffinityNode): boolean => {
        let current = node;
        while (current.parent_id) {
          if (current.parent_id === affinityNode.id) return true;
          const parent = affinityNodesById.get(current.parent_id);
          if (!parent) return false;
          current = parent;
        }
        return false;
      };
      const descendants = board.nodes.filter(isDescendant);
      await Promise.all(
        descendants.map((d) => board.updateNode(d.id, { pos_x: d.pos_x + deltaX, pos_y: d.pos_y + deltaY }))
      );
    }
    board.refresh();
  };

  async function handleAddSection() {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    await board.createNode({
      project_id: projectId,
      node_type: "section",
      label: "New Section",
      pos_x: center.x,
      pos_y: center.y,
      width: 340,
      height: 240,
    });
  }

  async function handleAddTheme() {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    await board.createNode({
      project_id: projectId,
      node_type: "theme",
      label: "New Theme",
      pos_x: center.x,
      pos_y: center.y,
      width: 300,
      height: 200,
    });
  }

  async function handleAddNote() {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    await board.createNode({
      project_id: projectId,
      node_type: "note",
      body: "",
      pos_x: center.x,
      pos_y: center.y,
      width: 220,
      height: 140,
      font_size: 14,
    });
  }

  function openTagPopover(nodeId: string, anchor: { top: number; left: number }) {
    setTagPopover({ nodeId, ...anchor });
  }

  async function handleToggleTag(tag: Tag) {
    if (!tagPopover) return;
    const assigned = (tagsByNode.get(tagPopover.nodeId) ?? []).some((t) => t.id === tag.id);
    if (assigned) {
      await board.unassignTag(tag.id, tagPopover.nodeId);
    } else {
      await board.assignTag(tag.id, tagPopover.nodeId);
    }
  }

  return (
    <AffinityBoardContext.Provider
      value={{
        tagsByNode,
        updateNode: board.updateNode,
        removeNode: board.removeNode,
        openTagPopover,
      }}
    >
      <div className="flex h-screen flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Button>
          <h1 className="font-display text-lg">Affinity Map — {projectName}</h1>
          {board.loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
          {board.error && <p className="ml-2 text-sm text-destructive">{board.error}</p>}
        </header>
        <AffinityBoardToolbar
          onAddSection={handleAddSection}
          onAddTheme={handleAddTheme}
          onAddNote={handleAddNote}
          onManageTags={() => setManageTagsOpen(true)}
        />
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={NODE_TYPES}
            onlyRenderVisibleElements
            minZoom={0.1}
            maxZoom={2}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {tagPopover && (
        <AffinityTagPopover
          position={{ top: tagPopover.top, left: tagPopover.left }}
          tags={board.tags}
          assignedTagIds={new Set((tagsByNode.get(tagPopover.nodeId) ?? []).map((t) => t.id))}
          onToggle={handleToggleTag}
          onClose={() => setTagPopover(null)}
        />
      )}

      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        tags={board.tags}
        onCreate={async (name, color) => {
          await tagsApi.create({ project_id: projectId, name, color });
          await board.refreshTags();
        }}
        onRemove={async (id) => {
          await tagsApi.remove(id);
          await board.refreshTags();
        }}
      />
    </AffinityBoardContext.Provider>
  );
}

export function AffinityBoardView() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return (
    <ReactFlowProvider>
      <AffinityBoardCanvas projectId={projectId} />
    </ReactFlowProvider>
  );
}
