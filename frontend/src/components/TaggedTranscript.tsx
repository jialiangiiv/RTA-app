import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TranscriptTag {
  key: string;
  start_offset: number;
  end_offset: number;
  label: string;
  definition: string;
  accepted?: boolean;
  /** Stable identity actions should key off — e.g. the original (pre-edit) code name — since
   *  `label` can change after an edit. Falls back to `key` when omitted. */
  codeKey?: string;
  /** Interview Question this code belongs to, shown in the hover popup. */
  iqLabel?: string;
}

type TagClassName = string | ((tag: TranscriptTag) => string);

interface TaggedTranscriptProps {
  rawText: string;
  leftTags: TranscriptTag[];
  rightTags: TranscriptTag[];
  highlightColor: string;
  leftTagClassName: TagClassName;
  rightTagClassName: TagClassName;
  renderLeftActions?: (tag: TranscriptTag) => ReactNode;
  renderRightActions?: (tag: TranscriptTag) => ReactNode;
}

const TAG_MIN_HEIGHT = 30;
const TAG_GAP = 4;
/** Grace period between leaving a tag/card and actually closing it — without this, moving the
 *  mouse from the tag toward a button on the card (crossing the `mt-1` gap between them) closes
 *  the card before the click lands. Mirrors TranscriptView's HighlightHoverCard timing. */
const HOVER_CLOSE_DELAY = 150;

/** Long code names shrink first; unlike the Codes tab/select-popover lists, margin tags wrap
 *  onto more lines (via break-words, no truncate) rather than losing text to an ellipsis — there's
 *  no editable form backing this view, so the full name has to stay legible in place. */
function marginTagTextClass(label: string): string {
  if (label.length > 28) return "text-[10px]";
  if (label.length > 16) return "text-[11px]";
  return "text-xs";
}

/** Walks text nodes under root to find the {node, offset} a raw_text character offset falls at. */
function locateOffset(root: Node, charOffset: number): { node: Node; offset: number } {
  let remaining = charOffset;
  let result: { node: Node; offset: number } | null = null;

  function walk(node: Node) {
    if (result) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (remaining <= len) {
        result = { node, offset: remaining };
        return;
      }
      remaining -= len;
    } else {
      node.childNodes.forEach(walk);
    }
  }
  walk(root);
  return result ?? { node: root, offset: 0 };
}

/** Greedily pushes down any tag whose measured top would collide with the one above it — uses
 *  each tag's own measured (possibly multi-line, wrapped) height rather than a fixed row height,
 *  so a long, wrapped label never overlaps the tag below it. */
function stackPositions(items: Array<{ key: string; top: number; height: number }>): Record<string, number> {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  let lastBottom = -Infinity;
  const next: Record<string, number> = {};
  for (const item of sorted) {
    const top = Math.max(item.top, lastBottom + TAG_GAP);
    next[item.key] = top;
    lastBottom = top + item.height;
  }
  return next;
}

/**
 * Renders ONE plain transcript text column with small margin tags on either side — left for the
 * user's own codes, right for an imported/candidate codebook's — rather than two separate copies
 * of the text. Hovering a tag (either side) temporarily highlights its exact span inline and
 * reveals a popup with the code's name, definition, and any actions (edit/accept).
 */
export function TaggedTranscript({
  rawText,
  leftTags,
  rightTags,
  highlightColor,
  leftTagClassName,
  rightTagClassName,
  renderLeftActions,
  renderRightActions,
}: TaggedTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [leftPositions, setLeftPositions] = useState<Record<string, number>>({});
  const [rightPositions, setRightPositions] = useState<Record<string, number>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hoverCloseTimeout = useRef<number | null>(null);

  function cancelHoverClose() {
    if (hoverCloseTimeout.current !== null) {
      window.clearTimeout(hoverCloseTimeout.current);
      hoverCloseTimeout.current = null;
    }
  }

  function scheduleHoverClose() {
    cancelHoverClose();
    hoverCloseTimeout.current = window.setTimeout(() => setHoveredKey(null), HOVER_CLOSE_DELAY);
  }

  function openHover(key: string) {
    cancelHoverClose();
    setHoveredKey(key);
  }

  useLayoutEffect(() => {
    function recompute() {
      const containerMaybeNull = containerRef.current;
      if (!containerMaybeNull) return;
      const container: HTMLDivElement = containerMaybeNull;
      const containerRect = container.getBoundingClientRect();

      function measure(tags: TranscriptTag[], buttonRefs: Record<string, HTMLButtonElement | null>) {
        return tags.map((tag) => {
          const { node, offset } = locateOffset(container, tag.start_offset);
          const range = document.createRange();
          range.setStart(node, offset);
          range.collapse(true);
          const rect = range.getBoundingClientRect();
          const top = rect.top - containerRect.top + container.scrollTop;
          const height = buttonRefs[tag.key]?.offsetHeight ?? TAG_MIN_HEIGHT;
          return { key: tag.key, top, height };
        });
      }

      setLeftPositions(stackPositions(measure(leftTags, leftButtonRefs.current)));
      setRightPositions(stackPositions(measure(rightTags, rightButtonRefs.current)));
    }

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [leftTags, rightTags, rawText]);

  const hovered = [...leftTags, ...rightTags].find((t) => t.key === hoveredKey) ?? null;

  // Document order across BOTH columns, so "next" walks the transcript top-to-bottom regardless
  // of which side a highlight is on, rather than exhausting one column before the other.
  const orderedTags = [
    ...leftTags.map((tag) => ({ tag, side: "left" as const })),
    ...rightTags.map((tag) => ({ tag, side: "right" as const })),
  ].sort((a, b) => a.tag.start_offset - b.tag.start_offset);
  const currentIndex = orderedTags.findIndex(({ tag }) => tag.key === hoveredKey);

  function goToNextHighlight() {
    if (orderedTags.length === 0) return;
    const next = orderedTags[(currentIndex + 1) % orderedTags.length];
    openHover(next.tag.key);
    const buttonRefs = next.side === "left" ? leftButtonRefs.current : rightButtonRefs.current;
    buttonRefs[next.tag.key]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderColumn(
    tags: TranscriptTag[],
    positions: Record<string, number>,
    buttonRefs: Record<string, HTMLButtonElement | null>,
    tagClassName: TagClassName,
    renderActions?: (tag: TranscriptTag) => ReactNode
  ) {
    return (
      <div className="relative w-44 shrink-0">
        {tags.map((tag) => (
          <div
            key={tag.key}
            className="absolute left-0 right-0"
            style={{ top: positions[tag.key] ?? 0 }}
            onMouseEnter={() => openHover(tag.key)}
            onMouseLeave={scheduleHoverClose}
          >
            <button
              ref={(el) => {
                buttonRefs[tag.key] = el;
              }}
              type="button"
              className={`w-full break-words rounded-sm border px-1.5 py-1 text-left font-medium leading-snug transition-colors ${marginTagTextClass(
                tag.label
              )} ${typeof tagClassName === "function" ? tagClassName(tag) : tagClassName}`}
            >
              {tag.accepted ? "✓ " : ""}
              {tag.label}
            </button>
            {hoveredKey === tag.key && (
              <div
                className="absolute left-0 top-full z-20 mt-1 w-64 space-y-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
                onMouseEnter={cancelHoverClose}
                onMouseLeave={scheduleHoverClose}
              >
                <p className="text-sm font-semibold">{tag.label}</p>
                <p className="text-xs text-muted-foreground">{tag.definition || "No definition."}</p>
                {tag.iqLabel && <p className="text-[11px] text-muted-foreground">IQ: {tag.iqLabel}</p>}
                {renderActions && <div className="flex flex-wrap gap-2 pt-1">{renderActions(tag)}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex gap-4">
      {orderedTags.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1}/{orderedTags.length} highlight{orderedTags.length === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            title="Jump to next highlight (left or right)"
            onClick={goToNextHighlight}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {renderColumn(leftTags, leftPositions, leftButtonRefs.current, leftTagClassName, renderLeftActions)}

      <div ref={containerRef} className="min-w-0 flex-1 [white-space:pre-wrap]">
        {hovered ? (
          <>
            {rawText.slice(0, hovered.start_offset)}
            <mark className="rounded-sm py-0.5 [mix-blend-mode:multiply]" style={{ backgroundColor: highlightColor }}>
              {rawText.slice(hovered.start_offset, hovered.end_offset)}
            </mark>
            {rawText.slice(hovered.end_offset)}
          </>
        ) : (
          rawText
        )}
      </div>

      {renderColumn(rightTags, rightPositions, rightButtonRefs.current, rightTagClassName, renderRightActions)}
    </div>
  );
}
