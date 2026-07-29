import { Router } from "express";
import { affinityNodesService } from "../services/affinityNodesService";

export const affinityNodesRouter = Router();

affinityNodesRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(affinityNodesService.listByProject(projectId));
});

affinityNodesRouter.post("/auto-seed", (req, res) => {
  const { project_id } = req.body as { project_id?: string };
  if (!project_id) return res.status(400).json({ error: "project_id is required" });
  res.json(affinityNodesService.autoSeed(project_id));
});

affinityNodesRouter.post("/", (req, res) => {
  const { project_id, node_type, pos_x, pos_y } = req.body as {
    project_id?: string;
    node_type?: string;
    pos_x?: number;
    pos_y?: number;
  };
  if (!project_id || !node_type || pos_x === undefined || pos_y === undefined) {
    return res.status(400).json({ error: "project_id, node_type, pos_x, and pos_y are required" });
  }
  try {
    res.status(201).json(affinityNodesService.create(req.body));
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

affinityNodesRouter.patch("/:id", (req, res) => {
  try {
    const updated = affinityNodesService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "AffinityNode not found" });
    res.json(updated);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

affinityNodesRouter.delete("/:id", (req, res) => {
  try {
    affinityNodesService.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});
