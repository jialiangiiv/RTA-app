import { Router } from "express";
import { researchQuestionsService } from "../services/researchQuestionsService";

export const researchQuestionsRouter = Router();

researchQuestionsRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(researchQuestionsService.listByProject(projectId));
});

researchQuestionsRouter.post("/", (req, res) => {
  const { project_id, label, text, notes } = req.body;
  if (!project_id || !label || !text) {
    return res.status(400).json({ error: "project_id, label, and text are required" });
  }
  res.status(201).json(researchQuestionsService.create({ project_id, label, text, notes }));
});

researchQuestionsRouter.patch("/:id", (req, res) => {
  const updated = researchQuestionsService.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "ResearchQuestion not found" });
  res.json(updated);
});

researchQuestionsRouter.delete("/:id", (req, res) => {
  researchQuestionsService.remove(req.params.id);
  res.status(204).send();
});
