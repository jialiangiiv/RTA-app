import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const PROJECT_JSON_TEMPLATE = `{
  "project": {
    "name": "My Project Name",
    "description": "Optional description",
    "highlight_color": "#b0461d"
  },
  "researchQuestions": [
    {
      "id": "rq1",
      "label": "RQ1",
      "text": "What are the...",
      "notes": null
    }
  ],
  "interviewQuestions": [
    {
      "id": "iq1",
      "research_question_id": "rq1",
      "label": "IQ1.1",
      "text": "Can you tell me about...",
      "description": null,
      "smallest_component": null,
      "selection_criterion_definition": null,
      "level_of_abstraction": null
    }
  ]
}`;

const WORKFLOW_STEPS = [
  {
    title: "Set up your project",
    body: "Name it, add Research Questions, and add Interview Questions under each — or import them from a JSON file (see above).",
  },
  {
    title: "Add transcripts",
    body: "Upload interview files named like P1.docx (a “P” + number, .docx or .pdf).",
  },
  {
    title: "Code",
    body: "Open a transcript, pick the Interview Question you're coding against, highlight text, and tag it with a code (name + definition).",
  },
  {
    title: "Compare & agree",
    body: "Share codebooks between coders, accept the codes you want, and merge into one agreed codebook.",
  },
  {
    title: "Organize",
    body: "Open the Affinity Map to see your codes auto-grouped under the Interview Question they were coded against, grouped into columns by Research Question. Drag codes into Theme/Section groups, or add sticky notes, to build your thematic structure.",
  },
  {
    title: "Export",
    body: "Export the codebook as Excel, or export the project's setup as JSON to reuse for a new study.",
  },
];

export function InstructionsPage() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(PROJECT_JSON_TEMPLATE);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 animate-fade-in space-y-1">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5">
          <Link to="/projects">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl">Instructions</h1>
        <p className="text-muted-foreground">A quick reference for importing a project and the overall workflow.</p>
      </header>

      <div className="space-y-6">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg">Importing a Project from JSON</CardTitle>
            <CardDescription>
              Project import only carries over setup information — Research Questions and Interview Questions.
              Transcripts and the Codebook are never included; add those after creating the project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                <code>{PROJECT_JSON_TEMPLATE}</code>
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute right-2 top-2 gap-1.5"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Add more entries to either array as needed.</li>
              <li>
                Each <code className="rounded bg-muted px-1 py-0.5 text-xs">interviewQuestions[].research_question_id</code>{" "}
                must match one of the <code className="rounded bg-muted px-1 py-0.5 text-xs">id</code>s you used above it in{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">researchQuestions</code> — these ids are just local
                placeholders to link the two arrays together in this file; the app assigns its own permanent ids on import.
              </li>
              <li>
                Save as a <code className="rounded bg-muted px-1 py-0.5 text-xs">.json</code> file and use it on the
                "New Project" screen's "Import Existing Project" card.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="animate-fade-in [animation-delay:80ms]">
          <CardHeader>
            <CardTitle className="text-lg">Workflow</CardTitle>
            <CardDescription>The typical path from a blank project to an organized set of themes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {WORKFLOW_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
