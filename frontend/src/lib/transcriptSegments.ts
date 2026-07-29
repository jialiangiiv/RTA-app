import { Bookmark, CodedExcerpt } from "../types/domain";

/** Walks text nodes under root to translate a DOM Range boundary into a raw_text character offset. */
export function textOffsetWithin(root: Node, target: Node, targetOffset: number): number {
  let offset = 0;
  let found = -1;

  function walk(node: Node) {
    if (found !== -1) return;
    if (node === target) {
      found = offset + targetOffset;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent ?? "").length;
    } else {
      node.childNodes.forEach(walk);
    }
  }
  walk(root);
  return found === -1 ? offset : found;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  excerpt: CodedExcerpt | null;
  bookmark: Bookmark | null;
  /** True while the user has this run selected and the "add code" popover is open —
   *  lets the not-yet-saved selection render a highlight before any CodedExcerpt exists. */
  pending: boolean;
}

/** Splits raw_text into runs at every CodedExcerpt/Bookmark/pending-selection boundary, for
 *  highlight rendering. pendingRange is the in-progress selection behind an open CodeSelectPopover
 *  (no CodedExcerpt exists yet, so it isn't covered by the excerpts boundaries above). */
export function buildSegments(
  rawText: string,
  excerpts: CodedExcerpt[],
  bookmarks: Bookmark[] = [],
  pendingRange: { start_offset: number; end_offset: number } | null = null
): TranscriptSegment[] {
  const boundaries = new Set<number>([0, rawText.length]);
  excerpts.forEach((e) => {
    boundaries.add(e.start_offset);
    boundaries.add(e.end_offset);
  });
  bookmarks.forEach((b) => boundaries.add(b.position));
  if (pendingRange) {
    boundaries.add(pendingRange.start_offset);
    boundaries.add(pendingRange.end_offset);
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const segments: TranscriptSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const excerpt = excerpts.find((e) => e.start_offset <= start && e.end_offset >= end) ?? null;
    const bookmark = bookmarks.find((b) => b.position === start) ?? null;
    const pending = pendingRange ? pendingRange.start_offset <= start && pendingRange.end_offset >= end : false;
    segments.push({ start, end, text: rawText.slice(start, end), excerpt, bookmark, pending });
  }
  return segments;
}
