import { Router } from "express";
import { qualitativeCodesService } from "../services/qualitativeCodesService";

export const qualitativeCodesRouter = Router();

qualitativeCodesRouter.get("/", (req, res) => {
  const codebookId = req.query.codebook_id as string | undefined;
  if (!codebookId) return res.status(400).json({ error: "codebook_id query param is required" });
  res.json(qualitativeCodesService.listByCodebook(codebookId));
});

// Registered before any generic "/:id"-shaped route to avoid path collisions.
qualitativeCodesRouter.get("/trash", (req, res) => {
  const codebookId = req.query.codebook_id as string | undefined;
  if (!codebookId) return res.status(400).json({ error: "codebook_id query param is required" });
  res.json(qualitativeCodesService.listTrashedByCodebook(codebookId));
});

qualitativeCodesRouter.post("/trash/purge-all", (req, res) => {
  const { codebook_id } = req.body;
  if (!codebook_id) return res.status(400).json({ error: "codebook_id is required" });
  res.json({ purged: qualitativeCodesService.purgeAllTrashed(codebook_id) });
});

qualitativeCodesRouter.post("/merge", (req, res) => {
  const { sourceIds, targetId } = req.body;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0 || !targetId) {
    return res.status(400).json({ error: "sourceIds (non-empty array) and targetId are required" });
  }
  try {
    res.json(qualitativeCodesService.merge(req.body));
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
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

qualitativeCodesRouter.post("/:id/restore", (req, res) => {
  try {
    const restored = qualitativeCodesService.restore(req.params.id);
    if (!restored) return res.status(404).json({ error: "Trashed QualitativeCode not found" });
    res.json(restored);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

qualitativeCodesRouter.delete("/:id/purge", (req, res) => {
  qualitativeCodesService.purge(req.params.id);
  res.status(204).send();
});
