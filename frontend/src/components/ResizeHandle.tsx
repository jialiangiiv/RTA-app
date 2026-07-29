interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

/** Thin draggable divider between a resizable side panel and the main content. */
export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent active:bg-accent"
      onMouseDown={onMouseDown}
    />
  );
}
