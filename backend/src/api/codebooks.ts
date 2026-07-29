import { Router } from "express";
import { codebooksService } from "../services/codebooksService";
import { codebookExcelService } from "../services/codebookExcelService";

export const codebooksRouter = Router();

codebooksRouter.get("/", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(codebooksService.listByProject(projectId));
});

/** Every Project has exactly one — this ensures it exists rather than asking the user to create one. */
codebooksRouter.get("/own", (req, res) => {
  const projectId = req.query.project_id as string | undefined;
  if (!projectId) return res.status(400).json({ error: "project_id query param is required" });
  res.json(codebooksService.ensureOwnCodebook(projectId));
});

codebooksRouter.get("/:id", (req, res) => {
  const codebook = codebooksService.get(req.params.id);
  if (!codebook) return res.status(404).json({ error: "Codebook not found" });
  res.json(codebook);
});

codebooksRouter.post("/", (req, res) => {
  const { project_id, name, version_label } = req.body;
  if (!project_id || !name || !version_label) {
    return res.status(400).json({ error: "project_id, name, and version_label are required" });
  }
  res.status(201).json(codebooksService.create(req.body));
});

codebooksRouter.get("/:id/export", async (req, res) => {
  try {
    const buffer = await codebookExcelService.exportToBuffer(req.params.id);
    const codebook = codebooksService.get(req.params.id)!;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${codebook.name}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

codebooksRouter.delete("/:id", (req, res) => {
  codebooksService.remove(req.params.id);
  res.status(204).send();
});
