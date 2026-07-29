import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranscripts } from "../hooks/useTranscripts";
import { transcriptsApi } from "../api/transcripts";
import { Transcript } from "../types/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TranscriptListProps {
  projectId: string;
  activeTranscriptId: string | null;
  onActiveTranscriptChange: (transcriptId: string) => void;
  onTranscriptsLoaded: (transcripts: Transcript[]) => void;
}

export function TranscriptList({
  projectId,
  activeTranscriptId,
  onActiveTranscriptChange,
  onTranscriptsLoaded,
}: TranscriptListProps) {
  const { transcripts, loading, error, refresh } = useTranscripts(projectId);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onTranscriptsLoaded(transcripts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcripts]);

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const transcript = await transcriptsApi.importFile({ project_id: projectId, title: file.name, file });
      await refresh();
      onActiveTranscriptChange(transcript.id);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        {importing ? "Importing…" : "Import Transcript (.docx/.pdf)"}
      </Button>
    </div>
  );
}
