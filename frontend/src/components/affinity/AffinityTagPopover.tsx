import { Tag } from "../../types/domain";

interface AffinityTagPopoverProps {
  position: { top: number; left: number };
  tags: Tag[];
  assignedTagIds: Set<string>;
  onToggle: (tag: Tag) => void;
  onClose: () => void;
}

/** Hand-positioned overlay anchored to the click point — same pattern as CodeSelectPopover /
 *  HighlightHoverCard, no Radix Popover needed. */
export function AffinityTagPopover({ position, tags, assignedTagIds, onToggle, onClose }: AffinityTagPopoverProps) {
  return (
    <>
      <div className="fixed inset-0 z-[900]" onClick={onClose} />
      <div
        className="fixed z-[901] flex w-56 max-w-[calc(100vw-2rem)] animate-fade-in flex-col gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
        style={{ top: position.top, left: position.left }}
      >
        {tags.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No tags yet — create one via "Manage Tags" in the toolbar.
          </p>
        ) : (
          tags.map((tag) => {
            const active = assignedTagIds.has(tag.id);
            return (
              <button
                key={tag.id}
                className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                  active ? "bg-accent" : ""
                }`}
                onClick={() => onToggle(tag)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ backgroundColor: tag.color ?? undefined }} />
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                {active && <span className="text-brand">✓</span>}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
