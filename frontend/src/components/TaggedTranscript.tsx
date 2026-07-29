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
  tags: TranscriptTag[];
  tagClassName: string;
  highlightColor: string;
  renderActions?: (tag: TranscriptTag) => ReactNode;
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

/**
 * Renders plain transcript text with small margin tags beside each tagged span (rather than an
 * inline background highlight) — hovering a tag temporarily highlights its exact text inline and
 * reveals a popup with the code's name, definition, and any actions (edit/accept).
 */
export function TaggedTranscript({ rawText, tags, tagClassName, highlightColor, renderActions }: TaggedTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const raw = tags.map((tag) => {
        const { node, offset } = locateOffset(container, tag.start_offset);
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        return { key: tag.key, top: rect.top - containerRect.top + container.scrollTop };
      });

      raw.sort((a, b) => a.top - b.top);
      let lastTop = -Infinity;
      const next: Record<string, number> = {};
      for (const item of raw) {
        const top = Math.max(item.top, lastTop + TAG_HEIGHT);
        next[item.key] = top;
        lastTop = top;
      }
      setPositions(next);
    }

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [tags, rawText]);

  const hovered = tags.find((t) => t.key === hoveredKey) ?? null;

  return (
    <div className="relative flex gap-4">
      <div ref={containerRef} className="min-w-0 flex-1 [white-space:pre-wrap]">
        {hovered ? (
          <>
            {rawText.slice(0, hovered.start_offset)}
            <mark
              className="rounded-sm py-0.5 [mix-blend-mode:multiply]"
              style={{ backgroundColor: highlightColor }}
            >
              {rawText.slice(hovered.start_offset, hovered.end_offset)}
            </mark>
            {rawText.slice(hovered.end_offset)}
          </>
        ) : (
          rawText
        )}
      </div>

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
    </div>
  );
}
