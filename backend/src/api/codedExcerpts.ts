import { Router } from "express";
import { codedExcerptsService } from "../services/codedExcerptsService";

export const codedExcerptsRouter = Router();

codedExcerptsRouter.get("/iq-map", (req, res) => {
  const codebookId = req.query.codebook_id as string | undefined;
  if (!codebookId) return res.status(400).json({ error: "codebook_id query param is required" });
  res.json(codedExcerptsService.codeInterviewQuestionMap(codebookId));
});

codedExcerptsRouter.get("/", (req, res) => {
  const transcriptId = req.query.transcript_id as string | undefined;
  const interviewQuestionId = req.query.interview_question_id as string | undefined;
  if (interviewQuestionId) return res.json(codedExcerptsService.listByInterviewQuestion(interviewQuestionId));
  if (!transcriptId) {
    return res.status(400).json({ error: "transcript_id or interview_question_id query param is required" });
  }
  res.json(codedExcerptsService.listByTranscript(transcriptId));
});

codedExcerptsRouter.post("/", (req, res) => {
  const { transcript_id, qualitative_code_id, interview_question_id, start_offset, end_offset } = req.body;
  if (
    !transcript_id ||
    !qualitative_code_id ||
    !interview_question_id ||
    start_offset === undefined ||
    end_offset === undefined
  ) {
    return res.status(400).json({
      error: "transcript_id, qualitative_code_id, interview_question_id, start_offset, and end_offset are required",
    });
  }
  res.status(201).json(codedExcerptsService.create(req.body));
});

codedExcerptsRouter.patch("/:id", (req, res) => {
  const updated = codedExcerptsService.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "CodedExcerpt not found" });
  res.json(updated);
});

codedExcerptsRouter.delete("/:id", (req, res) => {
  codedExcerptsService.remove(req.params.id);
  res.status(204).send();
});
