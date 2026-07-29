import { useRef, useState } from "react";

/**
 * Tracks a panel's pixel width, draggable via a handle on one edge. `handleSide` is which edge
 * the drag handle sits on — "right" (handle is this panel's right edge, e.g. a left-docked
 * panel) grows the panel when dragged rightward; "left" grows it when dragged leftward.
 */
export function useResizableWidth(initial: number, min: number, max: number, handleSide: "left" | "right") {
  const [width, setWidth] = useState(initial);
  const draggingRef = useRef(false);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    const startX = e.clientX;
    const startWidth = width;

    function onMove(moveEvent: MouseEvent) {
      if (!draggingRef.current) return;
      const rawDelta = moveEvent.clientX - startX;
      const delta = handleSide === "right" ? rawDelta : -rawDelta;
      setWidth(Math.min(max, Math.max(min, startWidth + delta)));
    }
    function onUp() {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { width, startDrag };
}
