import { TranscriptSegment } from "../lib/transcriptSegments";
import { CodedExcerpt } from "../types/domain";

interface TranscriptSegmentsProps {
  segments: TranscriptSegment[];
  highlightColor: string;
  /** Omit either to render read-only (no hover card wiring). */
  onHoverExcerpt?: (excerpt: CodedExcerpt, rect: DOMRect) => void;
  onUnhoverExcerpt?: () => void;
}

/** Renders pre-split transcript runs with q_code highlights and bookmark flags, for the normal coding view. */
export function TranscriptSegments({ segments, highlightColor, onHoverExcerpt, onUnhoverExcerpt }: TranscriptSegmentsProps) {
  return (
    <>
      {segments.map((segment) => {
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
          const excerpt = segment.excerpt;
          return (
            <span
              key={segment.start}
              id={`excerpt-${excerpt.id}`}
              className="relative rounded-sm py-0.5 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)] [mix-blend-mode:multiply]"
              style={{ backgroundColor: highlightColor }}
              onMouseEnter={(e) => onHoverExcerpt?.(excerpt, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={() => onUnhoverExcerpt?.()}
            >
              {marker}
              {segment.text}
            </span>
          );
        }

        if (segment.pending) {
          return (
            <span key={segment.start} className="rounded-sm bg-brand/25 py-0.5 shadow-[inset_0_-2px_0_rgba(176,70,29,0.5)]">
              {marker}
              {segment.text}
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
