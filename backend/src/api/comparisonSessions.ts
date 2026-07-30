import { Router } from "express";
import { comparisonSessionsService } from "../services/comparisonSessionsService";

export const comparisonSessionsRouter = Router();

comparisonSessionsRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  const session = comparisonSessionsService.getByProject(projectId);
  if (!session) return res.status(404).json({ error: "No saved comparison session" });
  res.json(session);
});

comparisonSessionsRouter.put("/", (req, res) => {
  const { project_id, owner_name, bundle, accepted_code_names, edited_by_code_name, excluded_code_names, excluded_right_keys } =
    req.body;
  if (!project_id || !owner_name || !bundle) {
    return res.status(400).json({ error: "project_id, owner_name, and bundle are required" });
  }
  res.json(
    comparisonSessionsService.save({
      project_id,
      owner_name,
      bundle,
      accepted_code_names: accepted_code_names ?? [],
      edited_by_code_name: edited_by_code_name ?? {},
      excluded_code_names: excluded_code_names ?? [],
      excluded_right_keys: excluded_right_keys ?? [],
    })
  );
});

comparisonSessionsRouter.delete("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  comparisonSessionsService.removeByProject(projectId);
  res.status(204).send();
});
