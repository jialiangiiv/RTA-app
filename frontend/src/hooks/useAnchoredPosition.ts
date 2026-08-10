import { useLayoutEffect, useRef, useState } from "react";

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Positions a `position: fixed` floating card next to an anchor rect (a text selection or a
 * highlighted span), flipping from below to above when the card's own rendered height wouldn't
 * fit in the remaining viewport space beneath the anchor — measured after each render since the
 * card's height depends on its own content (pagination, forms, etc).
 */
export function useAnchoredPosition<T extends HTMLElement>(anchor: AnchorRect) {
  const ref = useRef<T>(null);
  const [top, setTop] = useState(anchor.bottom + GAP);

  useLayoutEffect(() => {
    const height = ref.current?.getBoundingClientRect().height ?? 0;
    const fitsBelow = anchor.bottom + GAP + height <= window.innerHeight - VIEWPORT_MARGIN;
    setTop(fitsBelow ? anchor.bottom + GAP : Math.max(VIEWPORT_MARGIN, anchor.top - GAP - height));
  }, [anchor.top, anchor.bottom]);

  return { ref, top };
}
