import { Router } from "express";
import { qualitativeCodesService } from "../services/qualitativeCodesService";

export const qualitativeCodesRouter = Router();

qualitativeCodesRouter.get("/", (req, res) => {
  const codebookId = req.query.codebook_id as string | undefined;
  if (!codebookId) return res.status(400).json({ error: "codebook_id query param is required" });
  res.json(qualitativeCodesService.listByCodebook(codebookId));
});

qualitativeCodesRouter.post("/", (req, res) => {
  const { codebook_id, label, description } = req.body;
  if (!codebook_id || !label || !description) {
    return res.status(400).json({ error: "codebook_id, label, and description are required" });
  }
  try {
    res.status(201).json(qualitativeCodesService.create(req.body));
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

qualitativeCodesRouter.patch("/:id", (req, res) => {
  try {
    const updated = qualitativeCodesService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "QualitativeCode not found" });
    res.json(updated);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

qualitativeCodesRouter.delete("/:id", (req, res) => {
  qualitativeCodesService.remove(req.params.id);
  res.status(204).send();
});
