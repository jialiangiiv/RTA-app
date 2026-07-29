import { projectsService } from "./projectsService";
import { researchQuestionsService } from "./researchQuestionsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { db } from "../core/db";
import { InterviewQuestion, Project, ResearchQuestion } from "../models/types";

/**
 * "Project" here means setup information only — RQs and IQs, so a coder can reuse a study's
 * question design for a new Project. Transcripts and Codebooks are deliberately excluded: they
 * have their own dedicated import flows (Transcript upload; Codebook Share for comparing/merging
 * q_codes between coders — see codebookShareService), each of which carries data this bundle
 * doesn't and would otherwise go stale or conflict with. See PROJECT.md <FILE_IMPORT_EXPORT>.
 */
export interface ProjectBundle {
  project: Project;
  researchQuestions: ResearchQuestion[];
  interviewQuestions: InterviewQuestion[];
}

export const projectBundleService = {
  exportBundle(projectId: string): ProjectBundle {
    const project = projectsService.get(projectId);
    if (!project) throw new Error("Project not found");

    return {
      project,
      researchQuestions: researchQuestionsService.listByProject(projectId),
      interviewQuestions: interviewQuestionsService.listByProject(projectId),
    };
  },

  /**
   * Creates a brand-new Project with a fresh, empty own Codebook (autoCreateOwnCodebook default)
   * and no Transcripts — only the RQs/IQs carry over, with ids remapped.
   */
  importBundle(bundle: ProjectBundle, opts: { asComparisonSource: boolean }): Project {
    return db.transaction(() => {
      const newProject = projectsService.create({
        name: bundle.project.name,
        description: bundle.project.description,
      });
      if (opts.asComparisonSource) {
        db.prepare("UPDATE projects SET is_comparison_source = 1 WHERE id = ?").run(newProject.id);
      }
      if (bundle.project.highlight_color) {
        projectsService.update(newProject.id, { highlight_color: bundle.project.highlight_color });
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

      for (const iq of bundle.interviewQuestions) {
        interviewQuestionsService.create({
          project_id: newProject.id,
          research_question_id: rqIdMap.get(iq.research_question_id)!,
          label: iq.label,
          text: iq.text,
          description: iq.description,
          smallest_component: iq.smallest_component,
          selection_criterion_definition: iq.selection_criterion_definition,
          level_of_abstraction: iq.level_of_abstraction,
        });
      }

      return projectsService.get(newProject.id)!;
    })();
  },
};
