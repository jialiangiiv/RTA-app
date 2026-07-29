import { Router } from "express";
import { bookmarksService } from "../services/bookmarksService";

export const bookmarksRouter = Router();

bookmarksRouter.get("/", (req, res) => {
  const transcriptId = req.query.transcript_id as string | undefined;
  const userId = req.query.user_id as string | undefined;
  if (!transcriptId || !userId) {
    return res.status(400).json({ error: "transcript_id and user_id query params are required" });
  }
  res.json(bookmarksService.listByTranscriptAndUser(transcriptId, userId));
});

bookmarksRouter.post("/", (req, res) => {
  const { transcript_id, user_id, position, label } = req.body;
  if (!transcript_id || !user_id || position === undefined || !label) {
    return res.status(400).json({ error: "transcript_id, user_id, position, and label are required" });
  }
  res.status(201).json(bookmarksService.create({ transcript_id, user_id, position, label }));
});

bookmarksRouter.patch("/:id", (req, res) => {
  const updated = bookmarksService.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Bookmark not found" });
  res.json(updated);
});

bookmarksRouter.delete("/:id", (req, res) => {
  bookmarksService.remove(req.params.id);
  res.status(204).send();
});
