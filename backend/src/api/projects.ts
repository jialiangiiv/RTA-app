import { Router } from "express";
import multer from "multer";
import { projectsService } from "../services/projectsService";
import { projectBundleService, ProjectBundle } from "../services/projectBundleService";
import { codebookShareService, CodebookShareBundle } from "../services/codebookShareService";
import { codebooksService } from "../services/codebooksService";
import { codebookExcelService } from "../services/codebookExcelService";
import { codebookVersionsService, AcceptedCode } from "../services/codebookVersionsService";
import { logger } from "../core/logger";

const upload = multer({ storage: multer.memoryStorage() });

export const projectsRouter = Router();

projectsRouter.get("/", (_req, res) => {
  res.json(projectsService.list());
});

projectsRouter.get("/comparison-sources", (_req, res) => {
  res.json(projectsService.listComparisonSources());
});

projectsRouter.get("/:id", (req, res) => {
  const project = projectsService.get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json(project);
});

projectsRouter.post("/", (req, res) => {
  const { name, description, codebook_version } = req.body as {
    name?: string;
    description?: string;
    codebook_version?: string;
  };
  if (!name) return res.status(400).json({ error: "name is required" });
  if (!codebook_version || !codebook_version.trim()) {
    return res.status(400).json({ error: "codebook_version is required" });
  }
  res.status(201).json(projectsService.create({ name, description, codebookVersionLabel: codebook_version.trim() }));
});

projectsRouter.patch("/:id", (req, res) => {
  const updated = projectsService.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Project not found" });
  res.json(updated);
});

projectsRouter.delete("/:id", (req, res) => {
  projectsService.remove(req.params.id);
  res.status(204).send();
});

projectsRouter.post("/:id/move", (req, res) => {
  const { direction } = req.body as { direction?: "up" | "down" };
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ error: "direction ('up' or 'down') is required" });
  }
  projectsService.move(req.params.id, direction);
  res.json(projectsService.list());
});

projectsRouter.get("/:id/export", (req, res) => {
  try {
    const bundle = projectBundleService.exportBundle(req.params.id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.project.name}.rta.json"`);
    res.json(bundle);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

projectsRouter.post("/import", (req, res) => {
  const { bundle, as_comparison_source } = req.body as { bundle: ProjectBundle; as_comparison_source?: boolean };
  if (!bundle || !bundle.project) {
    return res.status(400).json({ error: "bundle (Project export JSON) is required" });
  }
  try {
    const project = projectBundleService.importBundle(bundle, { asComparisonSource: Boolean(as_comparison_source) });
    logger.info("project.imported", { project_id: project.id, as_comparison_source: Boolean(as_comparison_source) });
    res.status(201).json(project);
  } catch (err) {
    logger.error("project.import_failed", {});
    res.status(422).json({ error: (err as Error).message });
  }
});

/** Codebook + CodedExcerpts only, for two coders sharing the same Project/Transcripts — see codebookShareService. */
projectsRouter.get("/:id/codebook-export", (req, res) => {
  try {
    const bundle = codebookShareService.exportBundle(req.params.id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.project.name}.codebook.json"`);
    res.json(bundle);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

projectsRouter.post("/:id/codebook-import", (req, res) => {
  const { bundle, mode } = req.body as { bundle?: CodebookShareBundle; mode?: "merge" | "substitute" };
  if (!bundle || !bundle.project || !bundle.codes) {
    return res.status(400).json({ error: "bundle (Codebook export JSON) is required" });
  }
  if (mode !== "merge" && mode !== "substitute") {
    return res.status(400).json({ error: "mode ('merge' or 'substitute') is required" });
  }
  try {
    const result = codebookShareService.importBundle(req.params.id, bundle, mode);
    logger.info("codebook.shared_import", {
      project_id: req.params.id,
      mode,
      codes_created: result.codesCreated,
      codes_updated: result.codesUpdated,
      excerpts_created: result.excerptsCreated,
      excerpts_skipped: result.excerptsSkipped,
    });
    res.status(201).json(result);
  } catch (err) {
    logger.error("codebook.shared_import_failed", {});
    res.status(422).json({ error: (err as Error).message });
  }
});

/** Plain 3-column .xlsx import (IQ Text / Code Name / Code Definition) — merges into the Project's
 *  own Codebook by label, no CodedExcerpts created (see codebookExcelService.importFromBuffer). */
projectsRouter.post("/:id/codebook-import-excel", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  try {
    const result = await codebookExcelService.importFromBuffer(req.params.id, req.file.buffer);
    logger.info("codebook.excel_imported", {
      project_id: req.params.id,
      codes_created: result.codesCreated,
      codes_updated: result.codesUpdated,
      unmatched_iq_count: result.unmatchedIqCount,
    });
    res.status(201).json(result);
  } catch (err) {
    logger.error("codebook.excel_import_failed", {});
    res.status(422).json({ error: (err as Error).message });
  }
});

/** All Codebook versions for this Project, plus which one is currently active — powers the version picker. */
projectsRouter.get("/:id/codebook-versions", (req, res) => {
  const project = projectsService.get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const versions = codebooksService.listVersions(req.params.id);
  res.json({ versions, activeCodebookId: project.active_codebook_id });
});

projectsRouter.post("/:id/codebook-versions/:codebookId/activate", (req, res) => {
  try {
    const codebook = codebooksService.setActive(req.params.id, req.params.codebookId);
    res.json(codebook);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

/** Clones the active Codebook, folds in the accepted codes from a compare session, and activates the result. */
projectsRouter.post("/:id/codebook-versions/finish", (req, res) => {
  const { version_label, owner_name, accepted } = req.body as {
    version_label?: string;
    owner_name?: string;
    accepted?: AcceptedCode[];
  };
  if (!version_label || !owner_name || !accepted) {
    return res.status(400).json({ error: "version_label, owner_name, and accepted are required" });
  }
  try {
    const result = codebookVersionsService.finish(req.params.id, { version_label, owner_name, accepted });
    logger.info("codebook.compare_finished", {
      project_id: req.params.id,
      codes_accepted: result.codesAccepted,
      excerpts_created: result.excerptsCreated,
      excerpts_skipped: result.excerptsSkipped,
    });
    res.status(201).json(result);
  } catch (err) {
    logger.error("codebook.compare_finish_failed", {});
    res.status(422).json({ error: (err as Error).message });
  }
});
