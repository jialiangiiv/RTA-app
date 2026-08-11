import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { InterviewQuestion } from "../models/types";
import { affinityNodesService } from "./affinityNodesService";

export const interviewQuestionsService = {
  /** Ordered by sort_order — editable per-IQ via update() on the Project Setup page. */
  listByProject(projectId: string): InterviewQuestion[] {
    return db
      .prepare("SELECT * FROM interview_questions WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC")
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
    const { maxOrder } = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM interview_questions WHERE project_id = ?")
      .get(input.project_id) as { maxOrder: number };
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
      sort_order: maxOrder + 1,
    };
    db.prepare(
      `INSERT INTO interview_questions
       (id, project_id, research_question_id, label, text, description, smallest_component,
        selection_criterion_definition, level_of_abstraction, created_at, sort_order)
       VALUES
       (@id, @project_id, @research_question_id, @label, @text, @description, @smallest_component,
        @selection_criterion_definition, @level_of_abstraction, @created_at, @sort_order)`
    ).run(iq);
    return iq;
  },

  update(
    id: string,
    updates: Partial<
      Pick<
        InterviewQuestion,
        | "research_question_id"
        | "label"
        | "text"
        | "description"
        | "smallest_component"
        | "selection_criterion_definition"
        | "level_of_abstraction"
        | "sort_order"
      >
    >
  ): InterviewQuestion | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    db.prepare(
      `UPDATE interview_questions SET research_question_id = @research_question_id, label = @label, text = @text,
       description = @description, smallest_component = @smallest_component,
       selection_criterion_definition = @selection_criterion_definition,
       level_of_abstraction = @level_of_abstraction, sort_order = @sort_order WHERE id = @id`
    ).run(updated);
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM interview_questions WHERE id = ?").run(id);
    affinityNodesService.removeByRef("iq_board", id);
  },
};
