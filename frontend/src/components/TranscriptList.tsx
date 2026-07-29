import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranscripts } from "../hooks/useTranscripts";
import { transcriptsApi } from "../api/transcripts";
import { TranscriptSummary } from "../types/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TranscriptListProps {
  projectId: string;
  activeTranscriptId: string | null;
  onActiveTranscriptChange: (transcriptId: string) => void;
  onTranscriptsLoaded: (transcripts: TranscriptSummary[]) => void;
}

export function TranscriptList({
  projectId,
  activeTranscriptId,
  onActiveTranscriptChange,
  onTranscriptsLoaded,
}: TranscriptListProps) {
  const { transcripts, loading, error, refresh } = useTranscripts(projectId);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importing = importProgress !== null;

  useEffect(() => {
    onTranscriptsLoaded(transcripts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcripts]);

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length === 0) return;

    // Naming convention: transcripts are expected as P<participant number>.docx/.pdf (e.g. P1.docx).
    const NAME_PATTERN = /^P\d+\.(docx|pdf)$/i;
    const files = chosen.filter((f) => NAME_PATTERN.test(f.name));
    const rejected = chosen.filter((f) => !NAME_PATTERN.test(f.name)).map((f) => f.name);
    if (rejected.length > 0) {
      window.alert(
        `These file names don't match the expected P<number>.docx/.pdf format and were not imported:\n${rejected.join(
          "\n"
        )}\n\nPlease rename them (e.g. P1.docx) and try again.`
      );
    }
    if (files.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Parsing a transcript (mammoth/pdf-parse) is CPU-bound work on the backend — uploading many
    // files at once one-by-one keeps each import responsive instead of piling up concurrent parses.
    setImportProgress({ done: 0, total: files.length });
    const failures: string[] = [];
    let lastImportedId: string | null = null;

    for (const file of files) {
      try {
        const transcript = await transcriptsApi.importFile({ project_id: projectId, title: file.name, file });
        lastImportedId = transcript.id;
      } catch (err) {
        failures.push(`${file.name}: ${(err as Error).message}`);
      } finally {
        setImportProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
      }
    }

    await refresh();
    if (lastImportedId) onActiveTranscriptChange(lastImportedId);
    if (failures.length > 0) window.alert(`Some transcripts failed to import:\n${failures.join("\n")}`);

    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {transcripts.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">No Transcripts imported yet.</p>
      ) : (
        <ul className="space-y-1 rounded-md border p-1">
          {transcripts.map((t) => (
            <li key={t.id}>
              <button
                className={cn(
                  "w-full truncate rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  t.id === activeTranscriptId && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => onActiveTranscriptChange(t.id)}
                title={t.title}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf"
        multiple
        onChange={handleFileChosen}
        disabled={importing}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? `Importing ${importProgress!.done} of ${importProgress!.total}…` : "Import Transcripts (.docx/.pdf)"}
      </Button>
      {importing && importProgress!.total > 1 && (
        <p className="text-xs text-muted-foreground">
          Large files can take a moment each — please keep this tab open until it finishes.
        </p>
      )}
    </div>
  );
}
