import { FormEvent, useMemo, useState } from "react";
import { QualitativeCode } from "../types/domain";
import { codeLabelClassName } from "../lib/codeLabel";
import { AnchorRect, useAnchoredPosition } from "../hooks/useAnchoredPosition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 6;

interface CodeSelectPopoverProps {
  anchor: AnchorRect;
  codes: QualitativeCode[];
  onSelect: (code: QualitativeCode) => void;
  onCreateNew: (label: string, description: string) => void;
  onClose: () => void;
}

/**
 * Appears immediately after a text selection: search + paginated list of all q_codes, or
 * create a new one. Anchored to the selection's screen position rather than a fixed trigger
 * element, so this is a hand-positioned overlay rather than Radix Popover. Flips above the
 * anchor when there isn't enough viewport space below it.
 */
export function CodeSelectPopover({ anchor, codes, onSelect, onCreateNew, onClose }: CodeSelectPopoverProps) {
  const { ref, top } = useAnchoredPosition<HTMLDivElement>(anchor);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const filtered = useMemo(
    () => codes.filter((c) => c.label.toLowerCase().includes(search.toLowerCase())),
    [codes, search]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    onCreateNew(newLabel.trim(), newDescription.trim());
  }

  return (
    <>
      <div className="fixed inset-0 z-[900]" onClick={onClose} />
      <div
        ref={ref}
        className="fixed z-[901] flex w-72 max-w-[calc(100vw-2rem)] animate-fade-in flex-col gap-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
        style={{ top, left: anchor.left }}
      >
        <Input
          autoFocus
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search codes"
        />
        <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
          {paged.map((code) => (
            <li key={code.id}>
              <button
                className="w-full rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent"
                onClick={() => onSelect(code)}
                title={code.label}
              >
                <span className={codeLabelClassName(code.label, "block")}>
                  <span className="mr-1.5 text-muted-foreground" aria-hidden="true">
                    •
                  </span>
                  {code.label}
                </span>
              </button>
            </li>
          ))}
          {paged.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">No matching code.</li>}
        </ul>
        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ‹ Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next ›
            </Button>
          </div>
        )}
        <form className="animate-fade-in space-y-2 border-t pt-3" onSubmit={handleCreate}>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New code name" />
          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="New code definition"
          />
          <Button type="submit" variant="outline" size="sm" className="w-full" disabled={!newLabel.trim()}>
            Create &amp; Apply
          </Button>
        </form>
      </div>
    </>
  );
}
