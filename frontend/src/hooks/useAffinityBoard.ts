import { useCallback, useEffect, useState } from "react";
import { affinityNodesApi } from "../api/affinityNodes";
import { tagsApi } from "../api/tags";
import { AffinityNode, AffinityNodeTag, Tag } from "../types/domain";

/** Loads (and auto-seeds) the Affinity Map board for a Project: every RQ and every q_code in the
 *  active Codebook gets a node the first time this runs — see affinityNodesService.autoSeed. */
export function useAffinityBoard(projectId: string) {
  const [nodes, setNodes] = useState<AffinityNode[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignments, setAssignments] = useState<AffinityNodeTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [seededNodes, projectTags, tagAssignments] = await Promise.all([
        affinityNodesApi.autoSeed(projectId),
        tagsApi.listByProject(projectId),
        tagsApi.listAssignments(projectId),
      ]);
      setNodes(seededNodes);
      setTags(projectTags);
      setAssignments(tagAssignments);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshTags = useCallback(async () => {
    const [projectTags, tagAssignments] = await Promise.all([
      tagsApi.listByProject(projectId),
      tagsApi.listAssignments(projectId),
    ]);
    setTags(projectTags);
    setAssignments(tagAssignments);
  }, [projectId]);

  async function createNode(input: Parameters<typeof affinityNodesApi.create>[0]) {
    const node = await affinityNodesApi.create(input);
    setNodes((prev) => [...prev, node]);
    return node;
  }

  async function updateNode(id: string, updates: Partial<AffinityNode>) {
    const updated = await affinityNodesApi.update(id, updates);
    if (updated) setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  }

  async function removeNode(id: string) {
    await affinityNodesApi.remove(id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }

  async function assignTag(tagId: string, affinityNodeId: string) {
    await tagsApi.assign(tagId, affinityNodeId);
    setAssignments((prev) =>
      prev.some((a) => a.tag_id === tagId && a.affinity_node_id === affinityNodeId)
        ? prev
        : [...prev, { tag_id: tagId, affinity_node_id: affinityNodeId }]
    );
  }

  async function unassignTag(tagId: string, affinityNodeId: string) {
    await tagsApi.unassign(tagId, affinityNodeId);
    setAssignments((prev) => prev.filter((a) => !(a.tag_id === tagId && a.affinity_node_id === affinityNodeId)));
  }

  return {
    nodes,
    tags,
    assignments,
    loading,
    error,
    refresh,
    refreshTags,
    createNode,
    updateNode,
    removeNode,
    assignTag,
    unassignTag,
  };
}
