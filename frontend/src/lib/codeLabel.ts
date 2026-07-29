/** Long code names shrink first, then truncate with an ellipsis as the last resort — keeps
 *  code-name lists (Codes tab, code-select popover) from growing or wrapping awkwardly. */
export function codeLabelClassName(label: string, base = "font-medium"): string {
  if (label.length > 40) return `truncate text-[11px] ${base}`;
  if (label.length > 22) return `truncate text-xs ${base}`;
  return `truncate text-sm ${base}`;
}
