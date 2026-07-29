<PROJECT_META>
name: RTA App
purpose: Local-only web app for reflexive thematic analysis (RTA) of interview transcripts.
stack_frontend: React + TypeScript
stack_backend: Node/Express
storage: SQLite
runtime: desktop browser on localhost
</PROJECT_META>

<TERMS>
ResearchQuestion (RQ):
  - Project-level research question (e.g., "What risks do character-creators perceive…").
  - Interview questions belong to specific RQs.

InterviewQuestion (IQ):
  - Concrete question asked in interviews (e.g., "Have you experienced character cloning?").
  - Linked to one parent RQ.
  - Has optional analysis metadata:
    - description
    - smallest component of material which can be coded (sensibility)
    - definition of selection criterion
    - level of abstraction.

Codebook:
  - Named collection of q_codes with definitions, examples, themes, colors.
  - Multiple Codebooks per Project (A_initial, B_initial, Agreed_v1, etc.).

CodedExcerpt:
  - Highlighted span of Transcript.raw_text linked to a single q_code.
  - In this app, a CodedExcerpt is also associated with one InterviewQuestion (IQ) when coding “according to interview questions”.

Transcript:
  - Plain text of an interview imported from .docx/.pdf.
  - Original formatting is ignored; only text content is stored.

Bookmark:
  - Per-user marker in a Transcript for navigation (position + label).

Never treat q_code as p_code; q_codes and RQs/IQs are data, p_code is implementation.
</TERMS>

<USERS>
- Coder A:
  - local installation, own Projects, RQs, IQs, Codebooks, CodedExcerpts, Bookmarks.
- Coder B:
  - same on another machine.
- Each installation has one active User profile; Bookmarks and CodedExcerpts are associated with that User.
</USERS>

<DATA_MODEL>
Project:
  - id
  - name
  - description
  - current_phase (Phase1..Phase5)
  - created_at
  - updated_at

ResearchQuestion (RQ):
  - id
  - project_id
  - label (e.g., "RQ1", "RQ2")
  - text (full research question)
  - notes?

InterviewQuestion (IQ):
  - id
  - project_id
  - research_question_id (parent RQ)
  - label (e.g., "RQ1 2.1 Character Cloning…")
  - text (full interview question as asked)
  - description? (optional)
  - smallest_component? (optional sensibility: what is the smallest unit that can be coded)
  - selection_criterion_definition? (optional)
  - level_of_abstraction? (optional)
  - created_at

Transcript:
  - id
  - project_id
  - title
  - file_name
  - raw_text
  - created_at
  - notes?

Bookmark:
  - id
  - transcript_id
  - user_id
  - position (character offset in raw_text)
  - label
  - created_at

Codebook:
  - id
  - project_id
  - name
  - version_label
  - created_by
  - created_at
  - notes?
  - codes: list of QualitativeCode entries

QualitativeCode (q_code):
  - id
  - codebook_id
  - label
  - description
  - theme?
  - example_quote?
  - color?
  - created_at

CodedExcerpt:
  - id
  - transcript_id
  - qualitative_code_id
  - interview_question_id (IQ.id – coding “according to interview question”)
  - start_offset
  - end_offset
  - memo?
  - created_at

User:
  - id
  - display_name
</DATA_MODEL>

<FILE_IMPORT_EXPORT>
Transcripts:
  - import: .docx, .pdf
  - processing:
    - extract plain text
    - store as Transcript.raw_text
  - line labels like "S00:" / "S01:" are plain text, no special structure.

Codebooks (Excel, q_code data):
  - export:
    - .xlsx with columns:
      - VersionLabel
      - Theme
      - QCodeLabel
      - Description
      - Example
      - Color
  - import:
    - create NEW Codebook object from rows
    - do not auto-merge with existing Codebooks
    - old versions remain accessible.

Projects:
  - export: JSON (or zipped) file including:
    - Project
    - ResearchQuestions
    - InterviewQuestions
    - Transcripts
    - Codebooks
    - QualitativeCodes
    - CodedExcerpts
    - Bookmarks
    - User
  - import:
    - normal mode: load as standalone Project
    - comparison mode: load as read-only “other coder project”.
</FILE_IMPORT_EXPORT>

<WORKFLOW_PHASES>
Phase 0 – Project setup (new addition):
  - When users first enter the app:
    - create a Project
    - define ResearchQuestions (RQs) for the project
    - define InterviewQuestions (IQs), each linked to a specific RQ
    - set optional IQ metadata:
      - description
      - smallest_component
      - selection_criterion_definition
      - level_of_abstraction.

Phase 1 – Independent initial coding:
  - A and B import Transcripts for the Project.
  - They start coding transcripts one by one, selecting:
    - active Codebook
    - active InterviewQuestion (IQ) they are coding against.
  - CodedExcerpts are always linked to:
    - a q_code (QualitativeCode)
    - an InterviewQuestion (IQ).

Phase 2 – Agreed Codebook:
  - A and B compare q_codes, still in the context of RQs/IQs.
  - Construct agreed Codebook(s) (e.g., "Agreed_v1") using comparison tools.

Phase 3 – Double-coding (N Transcripts):
  - select four Transcripts as "double-coded set".
  - both coders code them according to InterviewQuestions, using agreed Codebook.
  - CodedExcerpts still carry IQ link + q_code.

Phase 4 – Refinement with N Transcripts:
  - additional Transcripts coded, per IQ, using agreed Codebook.
  - new q_codes added as needed; later merged into updated agreed Codebooks.

Phase 5 – Split remaining Transcripts:
  - remaining Transcripts assigned to A or B.
  - each coder continues coding per IQ, using the current agreed Codebook.

N depends on the user.
</WORKFLOW_PHASES>

<UI_SPEC>
Desktop-first layout with sensible resize behavior.

Main views:
- ProjectDashboard:
  - list Projects
  - actions:
    - create/open/delete Project
    - export/import Project

- ProjectSetupView (for RQs and IQs):
  - shown when Project is first created or edited.
  - RQ section:
    - list RQs
    - add/edit/remove RQs
  - IQ section:
    - list InterviewQuestions grouped under RQs
    - add/edit/remove IQs
    - fields:
      - label
      - text
      - description? (optional)
      - smallest_component? (optional)
      - selection_criterion_definition? (optional)
      - level_of_abstraction? (optional)

- ProjectWorkspace:
  - top bar:
    - project name
    - current phase
    - active Codebook
    - current RQ/IQ selection (e.g., dropdown: select InterviewQuestion to code against)
  - left sidebar:
    - Transcript list + filters (coded/uncoded/double-coded)
  - center:
    - TranscriptView OR ComparisonView
  - right sidebar:
    - Codebook panel (q_codes)
    - Bookmarks panel

- TranscriptView (single-coder):
  - displays Transcript.raw_text.
  - user chooses:
    - active InterviewQuestion (IQ) from the project questions panel.
    - active q_code from Codebook panel.
  - user selects text, creates CodedExcerpt:
    - linked to q_code
    - linked to chosen InterviewQuestion (IQ)
  - highlights show q_codes; IQ context is visible in the UI (e.g., header showing current question being analyzed).
  - Bookmarks:
    - per Transcript, per User
    - label + jump behavior.

- ComparisonView (A vs B):
  - split Transcript.raw_text:
    - left: CodedExcerpts (with q_codes + IQ links) from local Project
    - right: CodedExcerpts from imported other-coder Project
  - used for:
    - comparing q_codes within the same InterviewQuestion or RQ
    - building agreed Codebooks.

- CodebookEditor:
  - table of q_codes (label, description, theme, example, color)
  - list of Codebooks (versions)
  - Excel import/export.

- BookmarksPanel:
  - list of Bookmarks for current Transcript and User
  - click-to-jump, edit, delete.
</UI_SPEC>

<CODEBOOK_COMPARISON>
Input:
  - local Codebook version
  - imported Codebook version
Optional context:
  - filter or group q_codes by RQ or InterviewQuestion for comparison.

UI:
  - two columns of q_codes (QualitativeCode) from each Codebook.
  - actions:
    - add selected q_codes to new agreed Codebook
    - merge/rename q_codes.

Output:
  - new agreed Codebook (e.g., "Agreed_vX") used in TranscriptView and ComparisonView.

</CODEBOOK_COMPARISON>

<TEXT_AND_POSITIONS>
- CodedExcerpt positions:
  - start_offset, end_offset (character indices).
- Bookmark positions:
  - position (character index).
- Rendering:
  - split raw_text using offsets, wrap highlight spans for q_codes.
  - app does not interpret text as p_code; it is interview material only.
</TEXT_AND_POSITIONS>
