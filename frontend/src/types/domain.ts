/**
 * Domain primitive types, mirrored from backend/src/models/types.ts.
 * Field names match PROJECT.md <DATA_MODEL>. These describe q_code data
 * as p_code types — never the q_code content itself.
 */

export type Phase = "Phase0" | "Phase1" | "Phase2" | "Phase3" | "Phase4" | "Phase5";

export interface User {
  id: string;
  display_name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  current_phase: Phase;
  created_at: string;
  updated_at: string;
  /** True for a Project imported as a read-only reference copy — hidden from the main dashboard. */
  is_comparison_source: 0 | 1;
  /** Single highlight color used for every q_code's CodedExcerpts in this Project. */
  highlight_color: string;
  /** User-controlled dashboard ordering — lower sorts first. */
  sort_order: number;
  /** The Codebook version currently live for coding. */
  active_codebook_id: string | null;
}

export interface ResearchQuestion {
  id: string;
  project_id: string;
  label: string;
  text: string;
  notes: string | null;
}

export interface InterviewQuestion {
  id: string;
  project_id: string;
  research_question_id: string;
  label: string;
  text: string;
  description: string | null;
  smallest_component: string | null;
  selection_criterion_definition: string | null;
  level_of_abstraction: string | null;
  created_at: string;
}

export interface Transcript {
  id: string;
  project_id: string;
  title: string;
  file_name: string;
  raw_text: string;
  created_at: string;
  notes: string | null;
}

/** Transcript minus raw_text — what the list endpoint returns; fetch the full Transcript by id when the body is needed. */
export type TranscriptSummary = Omit<Transcript, "raw_text">;

export interface Bookmark {
  id: string;
  transcript_id: string;
  user_id: string;
  position: number;
  label: string;
  created_at: string;
}

export type CodebookKind = "own" | "comparison";

export interface Codebook {
  id: string;
  project_id: string;
  name: string;
  version_label: string;
  created_by: string | null;
  created_at: string;
  notes: string | null;
  /** 'own' = the Project's single auto-created codebook, always active for coding.
   *  'comparison' = a named, read-only import of someone else's codes. */
  kind: CodebookKind;
}

export interface QualitativeCode {
  id: string;
  codebook_id: string;
  label: string;
  description: string;
  theme: string | null;
  example_quote: string | null;
  color: string | null;
  created_at: string;
}

export interface CodedExcerpt {
  id: string;
  transcript_id: string;
  qualitative_code_id: string;
  interview_question_id: string;
  start_offset: number;
  end_offset: number;
  memo: string | null;
  created_at: string;
}

export type AffinityNodeType = "rq_lane" | "section" | "theme" | "code" | "note" | "unsorted";

/** One canvas-position row per visual node on the Affinity Map / Axial Coding board. 'rq_lane'
 *  and 'code' wrap an existing ResearchQuestion/QualitativeCode via ref_id (display text comes
 *  from the referenced row); 'section'/'theme'/'note' are freeform and own label/body/font_size;
 *  'unsorted' is a single auto-created top-level bin per project. parent_id expresses nesting. */
export interface AffinityNode {
  id: string;
  project_id: string;
  node_type: AffinityNodeType;
  parent_id: string | null;
  ref_id: string | null;
  label: string | null;
  body: string | null;
  pos_x: number;
  pos_y: number;
  width: number | null;
  height: number | null;
  font_size: number | null;
  color: string | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface AffinityNodeTag {
  affinity_node_id: string;
  tag_id: string;
}
