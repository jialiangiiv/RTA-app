import { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, Plus, BookOpen } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { projectsApi } from "../api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

export function ProjectDashboard() {
  const { projects, loading, error, refresh } = useProjects();
  const { user } = useCurrentUser();

  async function handleDelete(e: MouseEvent, projectId: string, name: string) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}" and everything in it? This cannot be undone.`)) return;
    await projectsApi.remove(projectId);
    refresh();
  }

  async function handleMove(e: MouseEvent, projectId: string, direction: "up" | "down") {
    e.stopPropagation();
    await projectsApi.move(projectId, direction);
    refresh();
  }

  return (
    <div className="container mx-auto max-w-5xl px-6 py-12">
      {/* Page title + the one primary action, in the same row — a familiar dashboard pattern. */}
      <header className="mb-8 flex animate-fade-in items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-5xl">Hi{user?.display_name.trim() ? `, ${user.display_name}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            Reflexive Thematic Analysis — you can create a project or choose one of your projects to start your
            reflexive thematic analysis.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="lg" className="gap-1.5">
            <Link to="/instructions">
              <BookOpen className="h-4 w-4" />
              Instructions
            </Link>
          </Button>
          <Button asChild size="lg" className="gap-1.5">
            <Link to="/projects/new">
              <Plus className="h-4 w-4" />
              Create a New Project
            </Link>
          </Button>
        </div>
      </header>

      <section className="animate-fade-in space-y-4 [animation-delay:80ms]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
          {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {!loading && projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet — create one above to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => (
              <Card key={project.id} className="flex flex-col transition-shadow hover:shadow-md">
                <Link to={`/projects/${project.id}`} className="flex-1 text-left">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.description || "No description"}</CardDescription>
                  </CardHeader>
                </Link>
                <CardFooter className="justify-between gap-1 border-t pt-4">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={i === 0}
                      title="Move up"
                      onClick={(e) => handleMove(e, project.id, "up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={i === projects.length - 1}
                      title="Move down"
                      onClick={(e) => handleMove(e, project.id, "down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <a href={projectsApi.exportUrl(project.id)} onClick={(e) => e.stopPropagation()}>
                        Export
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(e, project.id, project.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
