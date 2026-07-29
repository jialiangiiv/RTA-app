import { codebooksService } from "./codebooksService";
import { qualitativeCodesService } from "./qualitativeCodesService";
import { codedExcerptsService } from "./codedExcerptsService";
import { transcriptsService } from "./transcriptsService";
import { interviewQuestionsService } from "./interviewQuestionsService";
import { projectsService } from "./projectsService";
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
}

/**
 * Backs the "Compare" workflow: archiving labels the currently active Codebook in place (a
 * pure rename, so nothing is duplicated until a merge actually happens); finishing clones that
 * labeled Codebook into a new version, adds whichever codes the user accepted from the
 * imported side, and makes the result the new active version.
 */
export const codebookVersionsService = {
  archive(projectId: string, input: { version_label: string; owner_name: string }): Codebook {
    const active = codebooksService.ensureOwnCodebook(projectId);
    return codebooksService.rename(active.id, {
      version_label: input.version_label,
      name: `${input.version_label} — ${input.owner_name}`,
    });
  },

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
        const byLabel = new Map(existingCodes.map((qc) => [qc.label.trim().toLowerCase(), qc]));
        const codeNameToId = new Map<string, string>();
        const codeNameToIq = new Map<string, { id: string }>();

        const localIqs = interviewQuestionsService.listByProject(projectId);
        const localIqsByLabel = new Map(localIqs.map((iq) => [iq.label.trim().toLowerCase(), iq]));
        const localIqsByText = new Map(localIqs.map((iq) => [iq.text.trim().toLowerCase(), iq]));

        for (const accepted of input.accepted) {
          const key = accepted.code_name.trim().toLowerCase();
          const match = byLabel.get(key);
          if (match) {
            qualitativeCodesService.update(match.id, {
              description: accepted.code_definition || match.description,
            });
            codeNameToId.set(key, match.id);
          } else {
            const created = qualitativeCodesService.create({
              codebook_id: cloned.id,
              label: accepted.code_name,
              description: accepted.code_definition || accepted.code_name,
              theme: null,
              example_quote: null,
              color: null,
            });
            byLabel.set(key, created);
            codeNameToId.set(key, created.id);
            codesAccepted++;
          }

          const iq =
            localIqsByLabel.get(accepted.iq_label.trim().toLowerCase()) ??
            localIqsByText.get(accepted.iq_text.trim().toLowerCase());
          if (iq) codeNameToIq.set(key, iq);
        }

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

        for (const accepted of input.accepted) {
          const key = accepted.code_name.trim().toLowerCase();
          const localCodeId = codeNameToId.get(key);
          const iq = codeNameToIq.get(key);
          if (!localCodeId || !iq) {
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
        }
      } catch (err) {
        throw new Error(`Failed while finishing comparison: ${(err as Error).message}`);
      }

      projectsService.setActiveCodebook(projectId, cloned.id);

      return {
        codebook: cloned,
        codesCarried: priorCodeCount,
        codesAccepted,
        excerptsCreated,
        excerptsSkipped,
      };
    })();
  },
};
