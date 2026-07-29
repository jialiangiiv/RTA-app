import { db } from "../core/db";
import { newId } from "../core/ids";
import { projectsService } from "./projectsService";
import { researchQuestionsService } from "./researchQuestionsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { transcriptsService } from "./transcriptsService";
import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { bookmarksService } from "./bookmarksService";
import { usersService } from "./usersService";
import {
  Bookmark,
  Codebook,
  CodedExcerpt,
  InterviewQuestion,
  Project,
  QualitativeCode,
  ResearchQuestion,
  Transcript,
  User,
} from "../models/types";

export interface ProjectBundle {
  project: Project;
  researchQuestions: ResearchQuestion[];
  interviewQuestions: InterviewQuestion[];
  transcripts: Transcript[];
  codebooks: Codebook[];
  qualitativeCodes: QualitativeCode[];
  codedExcerpts: CodedExcerpt[];
  bookmarks: Bookmark[];
  users: User[];
}

export const projectBundleService = {
  /** Full Project graph, per PROJECT.md <FILE_IMPORT_EXPORT> Projects export. */
  exportBundle(projectId: string): ProjectBundle {
    const project = projectsService.get(projectId);
    if (!project) throw new Error("Project not found");

    const researchQuestions = researchQuestionsService.listByProject(projectId);
    const interviewQuestions = interviewQuestionsService.listByProject(projectId);
    const transcripts = transcriptsService.listByProject(projectId);
    const codebooks = codebooksService.listByProject(projectId);
    const qualitativeCodes = codebooks.flatMap((cb) => qualitativeCodesService.listByCodebook(cb.id));
    const codedExcerpts = transcripts.flatMap((t) => codedExcerptsService.listByTranscript(t.id));
    const bookmarks = transcripts.flatMap((t) => bookmarksService.listByTranscript(t.id));

    const userIds = new Set(bookmarks.map((b) => b.user_id));
    const users = Array.from(userIds)
      .map((id) => usersService.get(id))
      .filter((u): u is User => Boolean(u));

    return {
      project,
      researchQuestions,
      interviewQuestions,
      transcripts,
      codebooks,
      qualitativeCodes,
      codedExcerpts,
      bookmarks,
      users,
    };
  },

  /**
   * Recreates a Project graph locally with brand-new ids (foreign keys remapped).
   * `asComparisonSource` marks it read-only / hidden from the normal dashboard,
   * for use as the "other coder" side of ComparisonView.
   */
  importBundle(bundle: ProjectBundle, opts: { asComparisonSource: boolean }): Project {
    return db.transaction(() => {
      const newProject = projectsService.create({
        name: bundle.project.name,
        description: bundle.project.description,
        autoCreateOwnCodebook: false,
      });
      if (opts.asComparisonSource) {
        db.prepare("UPDATE projects SET is_comparison_source = 1 WHERE id = ?").run(newProject.id);
      }
      if (bundle.project.current_phase !== "Phase0") {
        projectsService.update(newProject.id, { current_phase: bundle.project.current_phase });
      }
      if (bundle.project.highlight_color) {
        projectsService.update(newProject.id, { highlight_color: bundle.project.highlight_color });
      }

      const userIdMap = new Map<string, string>();
      for (const user of bundle.users) {
        const existing = usersService.findByDisplayName(user.display_name);
        userIdMap.set(user.id, existing ? existing.id : usersService.create({ display_name: user.display_name }).id);
      }

      const rqIdMap = new Map<string, string>();
      for (const rq of bundle.researchQuestions) {
        const created = researchQuestionsService.create({
          project_id: newProject.id,
          label: rq.label,
          text: rq.text,
          notes: rq.notes,
        });
        rqIdMap.set(rq.id, created.id);
      }

      const iqIdMap = new Map<string, string>();
      for (const iq of bundle.interviewQuestions) {
        const created = interviewQuestionsService.create({
          project_id: newProject.id,
          research_question_id: rqIdMap.get(iq.research_question_id)!,
          label: iq.label,
          text: iq.text,
          description: iq.description,
          smallest_component: iq.smallest_component,
          selection_criterion_definition: iq.selection_criterion_definition,
          level_of_abstraction: iq.level_of_abstraction,
        });
        iqIdMap.set(iq.id, created.id);
      }

      const transcriptIdMap = new Map<string, string>();
      for (const t of bundle.transcripts) {
        const newTranscriptId = newId();
        db.prepare(
          `INSERT INTO transcripts (id, project_id, title, file_name, raw_text, created_at, notes)
           VALUES (@id, @project_id, @title, @file_name, @raw_text, @created_at, @notes)`
        ).run({
          id: newTranscriptId,
          project_id: newProject.id,
          title: t.title,
          file_name: t.file_name,
          raw_text: t.raw_text,
          created_at: t.created_at,
          notes: t.notes,
        });
        transcriptIdMap.set(t.id, newTranscriptId);
      }

      const codebookIdMap = new Map<string, string>();
      for (const cb of bundle.codebooks) {
        const created = codebooksService.create({
          project_id: newProject.id,
          name: cb.name,
          version_label: cb.version_label,
          created_by: cb.created_by ? userIdMap.get(cb.created_by) ?? null : null,
          notes: cb.notes,
          kind: cb.kind,
        });
        codebookIdMap.set(cb.id, created.id);
      }

      const qcodeIdMap = new Map<string, string>();
      for (const qc of bundle.qualitativeCodes) {
        const created = qualitativeCodesService.create({
          codebook_id: codebookIdMap.get(qc.codebook_id)!,
          label: qc.label,
          description: qc.description,
          theme: qc.theme,
          example_quote: qc.example_quote,
          color: qc.color,
        });
        qcodeIdMap.set(qc.id, created.id);
      }

      for (const ce of bundle.codedExcerpts) {
        codedExcerptsService.create({
          transcript_id: transcriptIdMap.get(ce.transcript_id)!,
          qualitative_code_id: qcodeIdMap.get(ce.qualitative_code_id)!,
          interview_question_id: iqIdMap.get(ce.interview_question_id)!,
          start_offset: ce.start_offset,
          end_offset: ce.end_offset,
          memo: ce.memo,
        });
      }

      for (const bm of bundle.bookmarks) {
        bookmarksService.create({
          transcript_id: transcriptIdMap.get(bm.transcript_id)!,
          user_id: userIdMap.get(bm.user_id)!,
          position: bm.position,
          label: bm.label,
        });
      }

      if (bundle.project.active_codebook_id) {
        const newActiveId = codebookIdMap.get(bundle.project.active_codebook_id);
        if (newActiveId) projectsService.setActiveCodebook(newProject.id, newActiveId);
      }

      return projectsService.get(newProject.id)!;
    })();
  },
};
