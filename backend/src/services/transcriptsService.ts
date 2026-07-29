import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { db } from "../core/db";
import { newId, nowIso } from "../core/ids";
import { logger } from "../core/logger";
import { Transcript } from "../models/types";

/** Extracts plain text from an imported transcript file. Original formatting is discarded. */
async function extractRawText(fileName: string, fileBuffer: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }
  if (ext === "pdf") {
    const result = await pdfParse(fileBuffer);
    return result.text;
  }
  throw new Error(`Unsupported transcript file type: .${ext}`);
}

export const transcriptsService = {
  listByProject(projectId: string): Transcript[] {
    return db.prepare("SELECT * FROM transcripts WHERE project_id = ?").all(projectId) as Transcript[];
  },

  get(id: string): Transcript | undefined {
    return db.prepare("SELECT * FROM transcripts WHERE id = ?").get(id) as Transcript | undefined;
  },

  async importFile(input: {
    project_id: string;
    title: string;
    file_name: string;
    file_buffer: Buffer;
    notes?: string | null;
  }): Promise<Transcript> {
    const raw_text = await extractRawText(input.file_name, input.file_buffer);
    const transcript: Transcript = {
      id: newId(),
      project_id: input.project_id,
      title: input.title,
      file_name: input.file_name,
      raw_text,
      created_at: nowIso(),
      notes: input.notes ?? null,
    };
    db.prepare(
      `INSERT INTO transcripts (id, project_id, title, file_name, raw_text, created_at, notes)
       VALUES (@id, @project_id, @title, @file_name, @raw_text, @created_at, @notes)`
    ).run(transcript);
    logger.info("transcript.imported", { transcript_id: transcript.id, file_name: transcript.file_name });
    return transcript;
  },

  remove(id: string): void {
    db.prepare("DELETE FROM transcripts WHERE id = ?").run(id);
  },
};
