import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { projectsService } from "./projectsService";
import { comparisonSessionsService } from "./comparisonSessionsService";
import { db } from "../core/db";
import { Codebook } from "../models/types";

export interface AcceptedCode {
  code_name: string;
  code_definition: string;
  iq_label: string;
  iq_text: string;
  coded_excerpts: Array<{ transcript_file_name: string; start_offset: number; end_offset: number }>;
}

export interface FinishResult {
  codebook: Codebook;
  codesCarried: number;
  codesAccepted: number;
  excerptsCreated: number;
  excerptsSkipped: number;
  /** How many CodedExcerpts landed in each Transcript — for the "N excerpts into P1.docx, M into P2.docx" summary. */
  excerptsByTranscript: Array<{ file_name: string; count: number }>;
}

/**
 * Backs the "Compare" workflow: finishing clones the Project's currently active Codebook into a
 * new version (the clone itself IS the archival point — no separate rename step needed), adds
 * whichever codes the user accepted from the imported side, and makes the result the new active
 * version.
 */
export const codebookVersionsService = {
  finish(
    projectId: string,
    input: { version_label: string; owner_name: string; accepted: AcceptedCode[] }
  ): FinishResult {
    return db.transaction((): FinishResult => {
      const active = codebooksService.ensureOwnCodebook(projectId);
      const priorCodeCount = qualitativeCodesService.listByCodebook(active.id).length;

      const cloned = codebooksService.clone(active.id, {
        name: `${input.version_label} — ${input.owner_name}`,
        version_label: input.version_label,
      });

      let codesAccepted = 0;
      let excerptsCreated = 0;
      let excerptsSkipped = 0;

      try {
        const existingCodes = qualitativeCodesService.listByCodebook(cloned.id);
        function codeKey(iqId: string | null, label: string): string {
          return `${iqId ?? "∅"}|${label.trim().toLowerCase()}`;
        }
        // Keyed by (IQ, label) instead of label alone — the same code_name can legitimately exist
        // under two different IQs, so upsert/dedup must be scoped per-IQ.
        const byKey = new Map(existingCodes.map((qc) => [codeKey(qc.interview_question_id, qc.label), qc]));

        const localIqs = interviewQuestionsService.listByProject(projectId);
        const localIqsByLabel = new Map(localIqs.map((iq) => [iq.label.trim().toLowerCase(), iq]));
        const localIqsByText = new Map(localIqs.map((iq) => [iq.text.trim().toLowerCase(), iq]));

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

        const createdByTranscript = new Map<string, number>();

        // Single pass per accepted code: resolve its IQ, upsert its code, then immediately create
        // its excerpts — keeps the code/IQ pairing exact for THIS entry, rather than re-looking it
        // up later by a plain code_name that could now be shared across differently-IQ'd codes.
        for (const accepted of input.accepted) {
          const iq =
            localIqsByLabel.get(accepted.iq_label.trim().toLowerCase()) ??
            localIqsByText.get(accepted.iq_text.trim().toLowerCase());

          const key = codeKey(iq?.id ?? null, accepted.code_name);
          const match = byKey.get(key);
          let codeId: string;
          if (match) {
            qualitativeCodesService.update(match.id, {
              description: accepted.code_definition || match.description,
            });
            codeId = match.id;
          } else {
            const created = qualitativeCodesService.create({
              codebook_id: cloned.id,
              interview_question_id: iq?.id ?? null,
              label: accepted.code_name,
              description: accepted.code_definition || accepted.code_name,
              theme: null,
              example_quote: null,
              color: null,
            });
            byKey.set(key, created);
            codeId = created.id;
            codesAccepted++;
          }

          if (!iq) {
            excerptsSkipped += accepted.coded_excerpts.length;
            continue;
          }

          for (const entry of accepted.coded_excerpts) {
            const transcript = localTranscriptsByFileName.get(entry.transcript_file_name);
            if (
              !transcript ||
              entry.start_offset < 0 ||
              entry.start_offset >= entry.end_offset ||
              entry.end_offset > transcript.raw_text.length
            ) {
              excerptsSkipped++;
              continue;
            }

            const keys = existingKeys(transcript.id);
            const dedupeKey = `${codeId}|${entry.start_offset}|${entry.end_offset}`;
            if (keys.has(dedupeKey)) {
              excerptsSkipped++;
              continue;
            }

            codedExcerptsService.create({
              transcript_id: transcript.id,
              qualitative_code_id: codeId,
              interview_question_id: iq.id,
              start_offset: entry.start_offset,
              end_offset: entry.end_offset,
              memo: null,
            });
            keys.add(dedupeKey);
            excerptsCreated++;
            createdByTranscript.set(transcript.file_name, (createdByTranscript.get(transcript.file_name) ?? 0) + 1);
          }
        }

        projectsService.setActiveCodebook(projectId, cloned.id);
        // A finished comparison has nothing left to resume — drop any saved in-progress session.
        comparisonSessionsService.removeByProject(projectId);

        return {
          codebook: cloned,
          codesCarried: priorCodeCount,
          codesAccepted,
          excerptsCreated,
          excerptsSkipped,
          excerptsByTranscript: Array.from(createdByTranscript, ([file_name, count]) => ({ file_name, count })),
        };
      } catch (err) {
        throw new Error(`Failed while finishing comparison: ${(err as Error).message}`);
      }
    })();
  },
};
