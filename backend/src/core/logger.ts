/**
 * Minimal logger. Never log full Transcript.raw_text or q_code content bodies
 * (see CLAUDE.md PRIVACY) — log identifiers/event names only.
 */
export const logger = {
  info(event: string, meta: Record<string, unknown> = {}) {
    console.log(`[info] ${event}`, meta);
  },
  error(event: string, meta: Record<string, unknown> = {}) {
    console.error(`[error] ${event}`, meta);
  },
};
