import { useMemo, useRef, useState } from "react";
import { codedExcerptsApi } from "../api/codedExcerpts";
import { qualitativeCodesApi } from "../api/codebooks";
import { buildSegments, textOffsetWithin } from "../lib/transcriptSegments";
import { TranscriptSegments } from "./TranscriptSegments";
import { CodeSelectPopover } from "./CodeSelectPopover";
import { Bookmark, CodedExcerpt, QualitativeCode, Transcript } from "../types/domain";

interface TranscriptViewProps {
  transcript: Transcript;
  codedExcerpts: CodedExcerpt[];
  qualitativeCodes: QualitativeCode[];
  qualitativeCodesById: Record<string, QualitativeCode>;
  ownCodebookId: string | null;
  highlightColor: string;
  activeInterviewQuestionId: string | null;
  bookmarks: Bookmark[];
  onExcerptsChanged: () => void;
  onCodesChanged: () => void;
  onCursorMove: (position: number) => void;
}

interface PendingSelection {
  start_offset: number;
  end_offset: number;
  popoverPosition: { top: number; left: number };
}

export function TranscriptView({
  transcript,
  codedExcerpts,
  qualitativeCodes,
  qualitativeCodesById,
  ownCodebookId,
  highlightColor,
  activeInterviewQuestionId,
  bookmarks,
  onExcerptsChanged,
  onCodesChanged,
  onCursorMove,
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const segments = useMemo(
    () => buildSegments(transcript.raw_text, codedExcerpts, bookmarks),
    [transcript.raw_text, codedExcerpts, bookmarks]
  );

  function handleMouseUp() {
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

    if (selection.isCollapsed) {
      onCursorMove(textOffsetWithin(container, range.startContainer, range.startOffset));
      return;
    }

    const a = textOffsetWithin(container, range.startContainer, range.startOffset);
    const b = textOffsetWithin(container, range.endContainer, range.endOffset);
    const start_offset = Math.min(a, b);
    const end_offset = Math.max(a, b);
    if (start_offset === end_offset) return;

    if (!activeInterviewQuestionId) {
      // No IQ exists yet for this Project — nothing to link the CodedExcerpt to. Silently
      // decline rather than interrupt with a popup; the banner above the text explains why.
      selection.removeAllRanges();
      return;
    }

    const rect = range.getBoundingClientRect();
    setPendingSelection({
      start_offset,
      end_offset,
      popoverPosition: { top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX },
    });
  }

  function closePopover() {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  async function applyCode(qualitativeCodeId: string) {
    if (!pendingSelection || !activeInterviewQuestionId) return;
    await codedExcerptsApi.create({
      transcript_id: transcript.id,
      qualitative_code_id: qualitativeCodeId,
      interview_question_id: activeInterviewQuestionId,
      start_offset: pendingSelection.start_offset,
      end_offset: pendingSelection.end_offset,
      memo: null,
    });
    closePopover();
    onExcerptsChanged();
  }

  async function handleCreateAndApply(label: string) {
    if (!ownCodebookId) return;
    try {
      const created = await qualitativeCodesApi.create({
        codebook_id: ownCodebookId,
        label,
        description: label,
        theme: null,
        example_quote: null,
        color: null,
      });
      onCodesChanged();
      await applyCode(created.id);
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  async function handleRemoveExcerpt(id: string) {
    await codedExcerptsApi.remove(id);
    onExcerptsChanged();
  }

  return (
    <div className="mx-auto max-w-[80ch]">
      {!activeInterviewQuestionId && (
        <p className="mb-6 border-l-2 border-border pl-3 text-sm text-muted-foreground">
          No Interview Question set up yet — add one from the Project tab's setup link to start coding.
        </p>
      )}
      <div
        className="select-text text-base leading-normal text-foreground [white-space:pre-wrap]"
        ref={containerRef}
        onMouseUp={handleMouseUp}
      >
        <TranscriptSegments
          segments={segments}
          qualitativeCodesById={qualitativeCodesById}
          highlightColor={highlightColor}
          onRemoveExcerpt={handleRemoveExcerpt}
        />
      </div>
      {pendingSelection && (
        <CodeSelectPopover
          position={pendingSelection.popoverPosition}
          codes={qualitativeCodes}
          onSelect={(code) => applyCode(code.id)}
          onCreateNew={handleCreateAndApply}
          onClose={closePopover}
        />
      )}
    </div>
  );
}
