import { ReactNode, useLayoutEffect, useRef, useState } from "react";

export interface TranscriptTag {
  key: string;
  start_offset: number;
  end_offset: number;
  label: string;
  definition: string;
  accepted?: boolean;
}

interface TaggedTranscriptProps {
  rawText: string;
  leftTags: TranscriptTag[];
  rightTags: TranscriptTag[];
  highlightColor: string;
  leftTagClassName: string;
  rightTagClassName: string;
  renderLeftActions?: (tag: TranscriptTag) => ReactNode;
  renderRightActions?: (tag: TranscriptTag) => ReactNode;
}

const TAG_HEIGHT = 30;

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

/** Greedily pushes down any tag whose measured top would collide with the one above it. */
function stackPositions(items: Array<{ key: string; top: number }>): Record<string, number> {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  let lastTop = -Infinity;
  const next: Record<string, number> = {};
  for (const item of sorted) {
    const top = Math.max(item.top, lastTop + TAG_HEIGHT);
    next[item.key] = top;
    lastTop = top;
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
  const [leftPositions, setLeftPositions] = useState<Record<string, number>>({});
  const [rightPositions, setRightPositions] = useState<Record<string, number>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useLayoutEffect(() => {
    function recompute() {
      const containerMaybeNull = containerRef.current;
      if (!containerMaybeNull) return;
      const container: HTMLDivElement = containerMaybeNull;
      const containerRect = container.getBoundingClientRect();

      function measure(tags: TranscriptTag[]) {
        return tags.map((tag) => {
          const { node, offset } = locateOffset(container, tag.start_offset);
          const range = document.createRange();
          range.setStart(node, offset);
          range.collapse(true);
          const rect = range.getBoundingClientRect();
          return { key: tag.key, top: rect.top - containerRect.top + container.scrollTop };
        });
      }

      setLeftPositions(stackPositions(measure(leftTags)));
      setRightPositions(stackPositions(measure(rightTags)));
    }

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [leftTags, rightTags, rawText]);

  const hovered = [...leftTags, ...rightTags].find((t) => t.key === hoveredKey) ?? null;

  function renderColumn(
    tags: TranscriptTag[],
    positions: Record<string, number>,
    tagClassName: string,
    renderActions?: (tag: TranscriptTag) => ReactNode
  ) {
    return (
      <div className="relative w-44 shrink-0">
        {tags.map((tag) => (
          <div
            key={tag.key}
            className="absolute left-0 right-0"
            style={{ top: positions[tag.key] ?? 0 }}
            onMouseEnter={() => setHoveredKey(tag.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <button
              type="button"
              className={`w-full truncate rounded-sm border px-1.5 py-1 text-left text-xs font-medium transition-colors ${tagClassName} ${
                tag.accepted ? "opacity-60" : ""
              }`}
            >
              {tag.accepted ? "✓ " : ""}
              {tag.label}
            </button>
            {hoveredKey === tag.key && (
              <div className="absolute left-0 top-full z-20 mt-1 w-64 space-y-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg">
                <p className="text-sm font-semibold">{tag.label}</p>
                <p className="text-xs text-muted-foreground">{tag.definition || "No definition."}</p>
                {renderActions && <div className="flex gap-2 pt-1">{renderActions(tag)}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex gap-4">
      {renderColumn(leftTags, leftPositions, leftTagClassName, renderLeftActions)}

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

      {renderColumn(rightTags, rightPositions, rightTagClassName, renderRightActions)}
    </div>
  );
}
