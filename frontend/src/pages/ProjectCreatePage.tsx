import { ChangeEvent, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload, PenLine } from "lucide-react";
import { projectsApi } from "../api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const project = await projectsApi.importFromFile({ file, asComparisonSource: false });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      window.alert((err as Error).message);
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 animate-fade-in space-y-1">
        <h1 className="text-3xl">New Project</h1>
        <p className="text-muted-foreground">Bring in an existing project, or set one up from scratch.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          className="animate-fade-in cursor-pointer transition-shadow hover:shadow-md [animation-delay:120ms]"
          onClick={() => navigate("/projects/new/setup")}
        >
          <CardHeader>
            <PenLine className="mb-2 h-6 w-6 text-brand" />
            <CardTitle className="text-lg">Set Up Manually</CardTitle>
            <CardDescription>Name your project, then define Research Questions, Interview Questions, and an optional Codebook.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline">
              Get Started
            </Button>
          </CardContent>
        </Card>
        
        <Card
          className="animate-fade-in cursor-pointer transition-shadow hover:shadow-md [animation-delay:60ms]"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardHeader>
            <Upload className="mb-2 h-6 w-6 text-brand" />
            <CardTitle className="text-lg">Import Existing Project</CardTitle>
            <CardDescription>Load a previously exported Project (.json) — RQs, IQs, Transcripts, and Codebook included.</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
            <Button type="button" variant="outline" disabled={importing} onClick={(e) => e.stopPropagation()}>
              {importing ? "Importing…" : "Choose .json file"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="ghost" className="mt-6">
        <Link to="/projects">← Back to Dashboard</Link>
      </Button>
    </div>
  );
}
