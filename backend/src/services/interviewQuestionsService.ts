import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { InterviewQuestion } from "../models/types";

export const interviewQuestionsService = {
  listByProject(projectId: string): InterviewQuestion[] {
    return db
      .prepare("SELECT * FROM interview_questions WHERE project_id = ?")
      .all(projectId) as InterviewQuestion[];
  },

  listByResearchQuestion(researchQuestionId: string): InterviewQuestion[] {
    return db
      .prepare("SELECT * FROM interview_questions WHERE research_question_id = ?")
      .all(researchQuestionId) as InterviewQuestion[];
  },

  get(id: string): InterviewQuestion | undefined {
    return db.prepare("SELECT * FROM interview_questions WHERE id = ?").get(id) as
      | InterviewQuestion
      | undefined;
  },

  create(input: {
    project_id: string;
    research_question_id: string;
    label: string;
    text: string;
    description?: string | null;
    smallest_component?: string | null;
    selection_criterion_definition?: string | null;
    level_of_abstraction?: string | null;
  }): InterviewQuestion {
    const iq: InterviewQuestion = {
      id: newId(),
      project_id: input.project_id,
      research_question_id: input.research_question_id,
      label: input.label,
      text: input.text,
      description: input.description ?? null,
      smallest_component: input.smallest_component ?? null,
      selection_criterion_definition: input.selection_criterion_definition ?? null,
      level_of_abstraction: input.level_of_abstraction ?? null,
      created_at: nowIso(),
    };
    db.prepare(
      `INSERT INTO interview_questions
       (id, project_id, research_question_id, label, text, description, smallest_component,
        selection_criterion_definition, level_of_abstraction, created_at)
       VALUES
       (@id, @project_id, @research_question_id, @label, @text, @description, @smallest_component,
        @selection_criterion_definition, @level_of_abstraction, @created_at)`
    ).run(iq);
    return iq;
  },

  update(
    id: string,
    updates: Partial<
      Pick<
        InterviewQuestion,
        | "label"
        | "text"
        | "description"
        | "smallest_component"
        | "selection_criterion_definition"
        | "level_of_abstraction"
      >
    >
  ): InterviewQuestion | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    db.prepare(
      `UPDATE interview_questions SET label = @label, text = @text, description = @description,
       smallest_component = @smallest_component,
       selection_criterion_definition = @selection_criterion_definition,
       level_of_abstraction = @level_of_abstraction WHERE id = @id`
    ).run(updated);
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM interview_questions WHERE id = ?").run(id);
  },
};
