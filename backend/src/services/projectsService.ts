import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { Project } from "../models/types";
import { codebooksService } from "./codebooksService";

const DEFAULT_HIGHLIGHT_COLOR = "#b0461d";

export const projectsService = {
  /** Normal dashboard listing — excludes Projects imported for ComparisonView. User-orderable. */
  list(): Project[] {
    return db
      .prepare("SELECT * FROM projects WHERE is_comparison_source = 0 ORDER BY sort_order ASC, created_at ASC")
      .all() as Project[];
  },

  listComparisonSources(): Project[] {
    return db
      .prepare("SELECT * FROM projects WHERE is_comparison_source = 1 ORDER BY updated_at DESC")
      .all() as Project[];
  },

  get(id: string): Project | undefined {
    return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
  },

  /**
   * Users don't create Codebooks — every Project auto-gets exactly one 'own' Codebook.
   * Pass autoCreateOwnCodebook: false only when the caller (Project bundle import) is about
   * to recreate the source's own Codebook itself, to avoid ending up with two.
   * codebookVersionLabel is user-provided at creation time (see ProjectSetupPage) — never
   * auto-generated; falls back to "current" only for internal callers that don't collect one.
   */
  create(input: {
    name: string;
    description?: string | null;
    autoCreateOwnCodebook?: boolean;
    codebookVersionLabel?: string;
  }): Project {
    const now = nowIso();
    const { maxOrder } = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM projects").get() as {
      maxOrder: number;
    };
    const project: Project = {
      id: newId(),
      name: input.name,
      description: input.description ?? null,
      current_phase: "Phase0",
      created_at: now,
      updated_at: now,
      is_comparison_source: 0,
      highlight_color: DEFAULT_HIGHLIGHT_COLOR,
      sort_order: maxOrder + 1,
      active_codebook_id: null,
    };
    this.insertFull(project);
    if (input.autoCreateOwnCodebook ?? true) {
      const versionLabel = input.codebookVersionLabel ?? "current";
      const codebook = codebooksService.create({
        project_id: project.id,
        name: versionLabel,
        version_label: versionLabel,
        kind: "own",
      });
      db.prepare("UPDATE projects SET active_codebook_id = ? WHERE id = ?").run(codebook.id, project.id);
      project.active_codebook_id = codebook.id;
    }
    return project;
  },

  /** Raw insert used by Project import — caller supplies the full row (see projectImportService). */
  insertFull(project: Project): void {
    db.prepare(
      `INSERT INTO projects (id, name, description, current_phase, created_at, updated_at, is_comparison_source, highlight_color, sort_order, active_codebook_id)
       VALUES (@id, @name, @description, @current_phase, @created_at, @updated_at, @is_comparison_source, @highlight_color, @sort_order, @active_codebook_id)`
    ).run(project);
  },

  setActiveCodebook(projectId: string, codebookId: string): void {
    db.prepare("UPDATE projects SET active_codebook_id = ? WHERE id = ?").run(codebookId, projectId);
  },

  update(
    id: string,
    updates: Partial<Pick<Project, "name" | "description" | "current_phase" | "highlight_color">>
  ): Project | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const updated: Project = { ...existing, ...updates, updated_at: nowIso() };
    db.prepare(
      `UPDATE projects SET name = @name, description = @description,
       current_phase = @current_phase, highlight_color = @highlight_color, updated_at = @updated_at WHERE id = @id`
    ).run(updated);
    return updated;
  },

  /** Swaps this Project's dashboard position with the one directly above/below it. */
  move(id: string, direction: "up" | "down"): void {
    const ordered = this.list();
    const index = ordered.findIndex((p) => p.id === id);
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || neighborIndex < 0 || neighborIndex >= ordered.length) return;

    const current = ordered[index];
    const neighbor = ordered[neighborIndex];
    db.transaction(() => {
      db.prepare("UPDATE projects SET sort_order = ? WHERE id = ?").run(neighbor.sort_order, current.id);
      db.prepare("UPDATE projects SET sort_order = ? WHERE id = ?").run(current.sort_order, neighbor.id);
    })();
  },

  remove(id: string): void {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  },
};
