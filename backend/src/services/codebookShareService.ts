import { db } from "../core/db";
import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { researchQuestionsService } from "./researchQuestionsService";
import { projectsService } from "./projectsService";
import { InterviewQuestion } from "../models/types";

export interface CodebookShareBundle {
  project: {
    name: string;
    description: string | null;
    highlight: string;
    /** The active Codebook's user-set version label at export time — informational only; import never applies it automatically. */
    codebook_version?: string;
  };
  questions: Array<{
    rq_label: string;
    rq_text: string;
    iq_label: string;
    iq_text: string;
    iq_description: string | null;
    "other meta info": string;
  }>;
  transcripts: Array<{ transcript_file_name: string }>;
  codes: Array<{
    code_name: string;
    code_definition: string;
    rq_label: string;
    rq_text: string;
    iq_label: string;
    iq_text: string;
  }>;
  coded_excerpts: Array<{
    code_name: string;
    transcript_file_name: string;
    start_offset: number;
    end_offset: number;
  }>;
}

export interface CodebookShareImportResult {
  codesCreated: number;
  codesUpdated: number;
  excerptsCreated: number;
  excerptsSkipped: number;
}

function otherMetaInfo(iq: InterviewQuestion): string {
  const parts: string[] = [];
  if (iq.smallest_component) parts.push(`smallest_component: ${iq.smallest_component}`);
  if (iq.selection_criterion_definition) parts.push(`selection_criterion_definition: ${iq.selection_criterion_definition}`);
  if (iq.level_of_abstraction) parts.push(`level_of_abstraction: ${iq.level_of_abstraction}`);
  return parts.join("; ");
}

/**
 * Project-level codebook + coded-excerpt sharing between two coders working on the SAME
 * project. Matches purely by human-readable name (transcript file name, code name, Interview
 * Question label/text) rather than internal ids, since the importer has their own separate
 * database with different row ids for what is conceptually the same project. Never touches
 * Bookmarks; they're user-local and outside this bundle shape entirely.
 */
export const codebookShareService = {
  exportBundle(projectId: string): CodebookShareBundle {
    const project = projectsService.get(projectId);
    if (!project) throw new Error("Project not found");

    const researchQuestions = researchQuestionsService.listByProject(projectId);
    const rqById = new Map(researchQuestions.map((rq) => [rq.id, rq]));
    const interviewQuestions = interviewQuestionsService.listByProject(projectId);
    const iqById = new Map(interviewQuestions.map((iq) => [iq.id, iq]));
    const transcripts = transcriptsService.listByProject(projectId);
    const transcriptsById = new Map(transcripts.map((t) => [t.id, t]));

    const codebook = codebooksService.ensureOwnCodebook(projectId);
    const codes = qualitativeCodesService.listByCodebook(codebook.id);
    const excerptsByCode = new Map(codes.map((c) => [c.id, codedExcerptsService.listByQualitativeCode(c.id)]));

    return {
      project: {
        name: project.name,
        description: project.description,
        highlight: project.highlight_color,
        codebook_version: codebook.version_label,
      },
      questions: interviewQuestions.map((iq) => {
        const rq = rqById.get(iq.research_question_id);
        return {
          rq_label: rq?.label ?? "",
          rq_text: rq?.text ?? "",
          iq_label: iq.label,
          iq_text: iq.text,
          iq_description: iq.description,
          "other meta info": otherMetaInfo(iq),
        };
      }),
      transcripts: transcripts.map((t) => ({ transcript_file_name: t.file_name })),
      codes: codes.map((code) => {
        // A code isn't intrinsically tied to one Interview Question in this app's model — this
        // takes the first CodedExcerpt's IQ as the code's "primary" one for the export, since the
        // wire format asks for a single rq/iq per code.
        const firstExcerpt = excerptsByCode.get(code.id)?.[0];
        const firstIq = firstExcerpt ? iqById.get(firstExcerpt.interview_question_id) : undefined;
        const rq = firstIq ? rqById.get(firstIq.research_question_id) : undefined;
        return {
          code_name: code.label,
          code_definition: code.description,
          rq_label: rq?.label ?? "",
          rq_text: rq?.text ?? "",
          iq_label: firstIq?.label ?? "",
          iq_text: firstIq?.text ?? "",
        };
      }),
      coded_excerpts: codes.flatMap((code) =>
        (excerptsByCode.get(code.id) ?? []).map((e) => ({
          code_name: code.label,
          transcript_file_name: transcriptsById.get(e.transcript_id)?.file_name ?? "",
          start_offset: e.start_offset,
          end_offset: e.end_offset,
        }))
      ),
    };
  },

  /** Transcript file names the bundle expects that aren't present locally — for the pre-import review screen. */
  findMissingTranscripts(projectId: string, bundle: CodebookShareBundle): string[] {
    const localFileNames = new Set(transcriptsService.listByProject(projectId).map((t) => t.file_name));
    return bundle.transcripts.map((t) => t.transcript_file_name).filter((name) => !localFileNames.has(name));
  },

  /**
   * Incorporates the bundle's codes into this Project's own Codebook (merge-by-name, or wipe
   * and replace), then best-effort recreates CodedExcerpts by resolving each entry's Transcript
   * by file_name and Interview Question via its code's rq/iq label — skipping (never failing)
   * rows that don't resolve locally. Runs as one transaction so a mid-way failure rolls back
   * cleanly; errors are prefixed with the phase that failed.
   */
  importBundle(projectId: string, bundle: CodebookShareBundle, mode: "merge" | "substitute"): CodebookShareImportResult {
    return db.transaction((): CodebookShareImportResult => {
      const codebook = codebooksService.ensureOwnCodebook(projectId);

      let existingCodes = qualitativeCodesService.listByCodebook(codebook.id);
      if (mode === "substitute") {
        for (const existing of existingCodes) {
          qualitativeCodesService.remove(existing.id);
        }
        existingCodes = [];
      }

      // Resolve each bundle code's local Interview Question — used to attribute its CodedExcerpts
      // to the right IQ below. Matching/reuse of the CODE itself, though, is by label alone: a
      // code is shared across however many IQs it's used under, not scoped to a single one.
      const localIqs = interviewQuestionsService.listByProject(projectId);
      const localIqsByLabel = new Map(localIqs.map((iq) => [iq.label.trim().toLowerCase(), iq]));
      const localIqsByText = new Map(localIqs.map((iq) => [iq.text.trim().toLowerCase(), iq]));
      function resolveIq(iqLabel: string, iqText: string): InterviewQuestion | undefined {
        return localIqsByLabel.get(iqLabel.trim().toLowerCase()) ?? localIqsByText.get(iqText.trim().toLowerCase());
      }
      function codeKey(label: string): string {
        return label.trim().toLowerCase();
      }

      const byKey = new Map(existingCodes.map((qc) => [codeKey(qc.label), qc]));
      // `bundle.coded_excerpts` entries only carry a plain code_name (no IQ) — these fallback maps
      // resolve them to whichever code/IQ was seen FIRST for that name, same as this flow's old
      // (pre-per-IQ) behavior. Only ambiguous if the bundle genuinely has two same-named codes
      // under different IQs, which the wire format has no way to disambiguate per-excerpt anyway.
      const codeIdByPlainName = new Map<string, string>();
      const iqByPlainName = new Map<string, InterviewQuestion>();
      let codesCreated = 0;
      let codesUpdated = 0;

      try {
        const seenKeys = new Set<string>();
        for (const code of bundle.codes) {
          const plainName = code.code_name.trim().toLowerCase();
          const iq = resolveIq(code.iq_label, code.iq_text);
          if (iq && !iqByPlainName.has(plainName)) iqByPlainName.set(plainName, iq);

          const key = codeKey(code.code_name);
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const match = byKey.get(key);
          let codeId: string;
          if (match) {
            qualitativeCodesService.update(match.id, { description: code.code_definition || match.description });
            codeId = match.id;
            codesUpdated++;
          } else {
            const created = qualitativeCodesService.create({
              codebook_id: codebook.id,
              interview_question_id: null,
              label: code.code_name,
              description: code.code_definition || code.code_name,
              theme: null,
              example_quote: null,
              color: null,
            });
            codeId = created.id;
            codesCreated++;
          }
          if (!codeIdByPlainName.has(plainName)) codeIdByPlainName.set(plainName, codeId);
        }
      } catch (err) {
        throw new Error(`Failed while incorporating codes: ${(err as Error).message}`);
      }

      let excerptsCreated = 0;
      let excerptsSkipped = 0;

      try {
        const localTranscriptsByFileName = new Map(
          transcriptsService.listByProject(projectId).map((t) => [t.file_name, t])
        );

        const existingKeysByTranscript = new Map<string, Set<string>>();
        function existingKeys(transcriptId: string): Set<string> {
          if (!existingKeysByTranscript.has(transcriptId)) {
            existingKeysByTranscript.set(
              transcriptId,
              new Set(
                codedExcerptsService
                  .listByTranscript(transcriptId)
                  .map((e) => `${e.qualitative_code_id}|${e.start_offset}|${e.end_offset}`)
              )
            );
          }
          return existingKeysByTranscript.get(transcriptId)!;
        }

        for (const entry of bundle.coded_excerpts) {
          const key = entry.code_name.trim().toLowerCase();
          const localCodeId = codeIdByPlainName.get(key);
          const transcript = localTranscriptsByFileName.get(entry.transcript_file_name);
          const iq = iqByPlainName.get(key);

          if (
            !localCodeId ||
            !transcript ||
            !iq ||
            entry.start_offset < 0 ||
            entry.start_offset >= entry.end_offset ||
            entry.end_offset > transcript.raw_text.length
          ) {
            excerptsSkipped++;
            continue;
          }

          const keys = existingKeys(transcript.id);
          const dedupeKey = `${localCodeId}|${entry.start_offset}|${entry.end_offset}`;
          if (keys.has(dedupeKey)) {
            excerptsSkipped++;
            continue;
          }

          codedExcerptsService.create({
            transcript_id: transcript.id,
            qualitative_code_id: localCodeId,
            interview_question_id: iq.id,
            start_offset: entry.start_offset,
            end_offset: entry.end_offset,
            memo: null,
          });
          keys.add(dedupeKey);
          excerptsCreated++;
        }
      } catch (err) {
        throw new Error(`Failed while creating highlights: ${(err as Error).message}`);
      }

      return { codesCreated, codesUpdated, excerptsCreated, excerptsSkipped };
    })();
  },
};
