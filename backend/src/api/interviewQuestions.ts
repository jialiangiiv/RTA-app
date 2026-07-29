import { Router } from "express";
import { interviewQuestionsService } from "../services/interviewQuestionsService";

export const interviewQuestionsRouter = Router();

interviewQuestionsRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  const researchQuestionId = req.query.research_question_id as string | undefined;
  if (researchQuestionId) {
    return res.json(interviewQuestionsService.listByResearchQuestion(researchQuestionId));
  }
  if (!projectId) return res.status(400).json({ error: "project_id or research_question_id query param is required" });
  res.json(interviewQuestionsService.listByProject(projectId));
});

interviewQuestionsRouter.post("/", (req, res) => {
  const { project_id, research_question_id, label, text } = req.body;
  if (!project_id || !research_question_id || !label || !text) {
    return res.status(400).json({ error: "project_id, research_question_id, label, and text are required" });
  }
  res.status(201).json(interviewQuestionsService.create(req.body));
});

interviewQuestionsRouter.patch("/:id", (req, res) => {
  const updated = interviewQuestionsService.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "InterviewQuestion not found" });
  res.json(updated);
});

interviewQuestionsRouter.delete("/:id", (req, res) => {
  interviewQuestionsService.remove(req.params.id);
  res.status(204).send();
});
