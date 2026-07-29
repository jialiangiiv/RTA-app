import { TranscriptSegment } from "../lib/transcriptSegments";
import { QualitativeCode } from "../types/domain";

interface TranscriptSegmentsProps {
  segments: TranscriptSegment[];
  qualitativeCodesById: Record<string, QualitativeCode>;
  /** Every CodedExcerpt in a Project renders in this one color — codes are told apart by their label, not hue. */
  highlightColor: string;
  /** Omit to render read-only. */
  onRemoveExcerpt?: (excerptId: string) => void;
}

/** Renders pre-split transcript runs with q_code highlights and bookmark flags, for the normal coding view. */
export function TranscriptSegments({ segments, qualitativeCodesById, highlightColor, onRemoveExcerpt }: TranscriptSegmentsProps) {
  return (
    <>
      {segments.map((segment) => {
        const qCode = segment.excerpt ? qualitativeCodesById[segment.excerpt.qualitative_code_id] : undefined;
        const marker = segment.bookmark && (
          <span
            key={`bookmark-${segment.bookmark.id}`}
            id={`bookmark-${segment.bookmark.id}`}
            className="mr-0.5 text-brand"
            title={segment.bookmark.label}
          >
            ⚑
          </span>
        );

        if (segment.excerpt) {
          return (
            <span
              key={segment.start}
              className="relative rounded-sm py-0.5 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)] [mix-blend-mode:multiply]"
              style={{ backgroundColor: highlightColor }}
              title={qCode ? qCode.label + (segment.excerpt.memo ? ` — ${segment.excerpt.memo}` : "") : "code"}
            >
              {marker}
              {segment.text}
              {onRemoveExcerpt && (
                <button
                  type="button"
                  className="ml-0.5 align-super text-xs font-bold text-foreground [mix-blend-mode:normal] hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveExcerpt(segment.excerpt!.id);
                  }}
                  title="Remove this CodedExcerpt"
                >
                  ×
                </button>
              )}
            </span>
          );
        }

        return (
          <span key={segment.start}>
            {marker}
            {segment.text}
          </span>
        );
      })}
    </>
  );
}
