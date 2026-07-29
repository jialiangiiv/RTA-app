-- RTA App schema. Entity names mirror PROJECT.md <DATA_MODEL> exactly.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  current_phase TEXT NOT NULL DEFAULT 'Phase0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_comparison_source INTEGER NOT NULL DEFAULT 0,
  highlight_color TEXT NOT NULL DEFAULT '#b0461d',
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Which Codebook version is live for coding right now — a Project can accumulate several
  -- versions over time (via archiving + comparison merges), but only one is active at once.
  active_codebook_id TEXT REFERENCES codebooks(id)
);

CREATE TABLE IF NOT EXISTS research_questions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  text TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS interview_questions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  research_question_id TEXT NOT NULL REFERENCES research_questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  smallest_component TEXT,
  selection_criterion_definition TEXT,
  level_of_abstraction TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Every Project gets exactly one kind='own' Codebook, auto-created (see projectsService.create) —
-- users never see a "create codebook" step for their own codes. kind='comparison' rows are
-- named, read-only imports of someone else's codes for side-by-side reference only.
CREATE TABLE IF NOT EXISTS codebooks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version_label TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  notes TEXT,
  kind TEXT NOT NULL DEFAULT 'own'
);

CREATE TABLE IF NOT EXISTS qualitative_codes (
  id TEXT PRIMARY KEY,
  codebook_id TEXT NOT NULL REFERENCES codebooks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  theme TEXT,
  example_quote TEXT,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coded_excerpts (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  qualitative_code_id TEXT NOT NULL REFERENCES qualitative_codes(id) ON DELETE CASCADE,
  interview_question_id TEXT NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_questions_project ON research_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_project ON interview_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_rq ON interview_questions(research_question_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_project ON transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_transcript ON bookmarks(transcript_id);
CREATE INDEX IF NOT EXISTS idx_codebooks_project ON codebooks(project_id);
CREATE INDEX IF NOT EXISTS idx_qualitative_codes_codebook ON qualitative_codes(codebook_id);
CREATE INDEX IF NOT EXISTS idx_coded_excerpts_transcript ON coded_excerpts(transcript_id);
CREATE INDEX IF NOT EXISTS idx_coded_excerpts_iq ON coded_excerpts(interview_question_id);
