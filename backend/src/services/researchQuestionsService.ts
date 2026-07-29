import { db } from "../core/db";
import { newId } from "../core/ids";
import { ResearchQuestion } from "../models/types";

export const researchQuestionsService = {
  listByProject(projectId: string): ResearchQuestion[] {
    return db
      .prepare("SELECT * FROM research_questions WHERE project_id = ?")
      .all(projectId) as ResearchQuestion[];
  },

  get(id: string): ResearchQuestion | undefined {
    return db.prepare("SELECT * FROM research_questions WHERE id = ?").get(id) as
      | ResearchQuestion
      | undefined;
  },

  create(input: { project_id: string; label: string; text: string; notes?: string | null }): ResearchQuestion {
    const rq: ResearchQuestion = {
      id: newId(),
      project_id: input.project_id,
      label: input.label,
      text: input.text,
      notes: input.notes ?? null,
    };
    db.prepare(
      "INSERT INTO research_questions (id, project_id, label, text, notes) VALUES (@id, @project_id, @label, @text, @notes)"
    ).run(rq);
    return rq;
  },

  update(id: string, updates: Partial<Pick<ResearchQuestion, "label" | "text" | "notes">>): ResearchQuestion | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    db.prepare("UPDATE research_questions SET label = @label, text = @text, notes = @notes WHERE id = @id").run(
      updated
    );
    return updated;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM research_questions WHERE id = ?").run(id);
  },
};
