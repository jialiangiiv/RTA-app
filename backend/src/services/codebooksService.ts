import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { Codebook, CodebookKind } from "../models/types";
import { projectsService } from "./projectsService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";

export const codebooksService = {
  listByProject(projectId: string): Codebook[] {
    return db
      .prepare("SELECT * FROM codebooks WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Codebook[];
  },

  /** All coding-usable versions of this Project's Codebook (archived snapshots + merge outcomes included). */
  listVersions(projectId: string): Codebook[] {
    return db
      .prepare("SELECT * FROM codebooks WHERE project_id = ? AND kind = 'own' ORDER BY created_at ASC")
      .all(projectId) as Codebook[];
  },

  getOwnByProject(projectId: string): Codebook | undefined {
    return db.prepare("SELECT * FROM codebooks WHERE project_id = ? AND kind = 'own' LIMIT 1").get(projectId) as
      | Codebook
      | undefined;
  },

  /**
   * The Codebook version live for coding right now. Resolves via Project.active_codebook_id;
   * falls back to creating a first 'own' Codebook for Projects that predate versioning (or a
   * fresh Project), and always keeps active_codebook_id pointed at whatever it returns.
   */
  ensureOwnCodebook(projectId: string): Codebook {
    const project = projectsService.get(projectId);
    if (project?.active_codebook_id) {
      const active = this.get(project.active_codebook_id);
      if (active) return active;
    }
    const existing = this.getOwnByProject(projectId);
    if (existing) {
      projectsService.setActiveCodebook(projectId, existing.id);
      return existing;
    }
    const created = this.create({ project_id: projectId, name: "My Codes", version_label: "current", kind: "own" });
    projectsService.setActiveCodebook(projectId, created.id);
    return created;
  },

  /** Points this Project's live coding at a different existing Codebook version. */
  setActive(projectId: string, codebookId: string): Codebook {
    const codebook = this.get(codebookId);
    if (!codebook || codebook.project_id !== projectId) {
      throw new Error("That Codebook version doesn't belong to this Project.");
    }
    projectsService.setActiveCodebook(projectId, codebookId);
    return codebook;
  },

  get(id: string): Codebook | undefined {
    return db.prepare("SELECT * FROM codebooks WHERE id = ?").get(id) as Codebook | undefined;
  },

  create(input: {
    project_id: string;
    name: string;
    version_label: string;
    created_by?: string | null;
    notes?: string | null;
    kind?: CodebookKind;
  }): Codebook {
    const codebook: Codebook = {
      id: newId(),
      project_id: input.project_id,
      name: input.name,
      version_label: input.version_label,
      created_by: input.created_by ?? null,
      created_at: nowIso(),
      notes: input.notes ?? null,
      kind: input.kind ?? "own",
    };
    db.prepare(
      `INSERT INTO codebooks (id, project_id, name, version_label, created_by, created_at, notes, kind)
       VALUES (@id, @project_id, @name, @version_label, @created_by, @created_at, @notes, @kind)`
    ).run(codebook);
    return codebook;
  },

  /** Deep-copies a Codebook's QualitativeCodes and their CodedExcerpts into a brand-new Codebook version. */
  clone(sourceCodebookId: string, target: { name: string; version_label: string; created_by?: string | null }): Codebook {
    const source = this.get(sourceCodebookId);
    if (!source) throw new Error("Codebook not found");

    const cloned = this.create({
      project_id: source.project_id,
      name: target.name,
      version_label: target.version_label,
      created_by: target.created_by ?? null,
      kind: "own",
    });

    const codeIdMap = new Map<string, string>();
    for (const code of qualitativeCodesService.listByCodebook(source.id)) {
      const newCode = qualitativeCodesService.create({
        codebook_id: cloned.id,
        interview_question_id: code.interview_question_id,
        label: code.label,
        description: code.description,
        theme: code.theme,
        example_quote: code.example_quote,
        color: code.color,
      });
      codeIdMap.set(code.id, newCode.id);
    }

    for (const [oldCodeId, newCodeId] of codeIdMap) {
      for (const excerpt of codedExcerptsService.listByQualitativeCode(oldCodeId)) {
        codedExcerptsService.create({
          transcript_id: excerpt.transcript_id,
          qualitative_code_id: newCodeId,
          interview_question_id: excerpt.interview_question_id,
          start_offset: excerpt.start_offset,
          end_offset: excerpt.end_offset,
          memo: excerpt.memo,
        });
      }
    }

    return cloned;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM codebooks WHERE id = ?").run(id);
  },
};
