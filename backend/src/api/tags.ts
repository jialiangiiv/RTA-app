import { Router } from "express";
import { tagsService } from "../services/tagsService";

export const tagsRouter = Router();

tagsRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(tagsService.listByProject(projectId));
});

tagsRouter.get("/assignments", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(tagsService.listAssignments(projectId));
});

tagsRouter.post("/", (req, res) => {
  const { project_id, name } = req.body as { project_id?: string; name?: string };
  if (!project_id || !name) return res.status(400).json({ error: "project_id and name are required" });
  try {
    res.status(201).json(tagsService.create(req.body));
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

tagsRouter.patch("/:id", (req, res) => {
  try {
    const updated = tagsService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Tag not found" });
    res.json(updated);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

tagsRouter.delete("/:id", (req, res) => {
  tagsService.remove(req.params.id);
  res.status(204).send();
});

tagsRouter.post("/:id/assign", (req, res) => {
  const { affinity_node_id } = req.body as { affinity_node_id?: string };
  if (!affinity_node_id) return res.status(400).json({ error: "affinity_node_id is required" });
  tagsService.assign(req.params.id, affinity_node_id);
  res.status(201).json({ affinity_node_id, tag_id: req.params.id });
});

tagsRouter.delete("/:id/assign/:affinityNodeId", (req, res) => {
  tagsService.unassign(req.params.id, req.params.affinityNodeId);
  res.status(204).send();
});
