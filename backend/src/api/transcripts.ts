import { Router } from "express";
import multer from "multer";
import { transcriptsService } from "../services/transcriptsService";
import { logger } from "../core/logger";

const upload = multer({ storage: multer.memoryStorage() });

export const transcriptsRouter = Router();

transcriptsRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(transcriptsService.listByProject(projectId));
});

transcriptsRouter.get("/:id", (req, res) => {
  const transcript = transcriptsService.get(req.params.id);
  if (!transcript) return res.status(404).json({ error: "Transcript not found" });
  res.json(transcript);
});

transcriptsRouter.post("/", upload.single("file"), async (req, res) => {
  const { project_id, title, notes } = req.body;
  if (!project_id || !title || !req.file) {
    return res.status(400).json({ error: "project_id, title, and file are required" });
  }
  try {
    const transcript = await transcriptsService.importFile({
      project_id,
      title,
      file_name: req.file.originalname,
      file_buffer: req.file.buffer,
      notes,
    });
    res.status(201).json(transcript);
  } catch (err) {
    logger.error("transcript.import_failed", { file_name: req.file?.originalname });
    res.status(422).json({ error: (err as Error).message });
  }
});

transcriptsRouter.delete("/:id", (req, res) => {
  transcriptsService.remove(req.params.id);
  res.status(204).send();
});
