import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import { config } from "./core/config";
import { logger } from "./core/logger";
import { apiRouter } from "./api";
import "./models/migrate";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// In development the frontend runs on its own Vite dev server (port 5173, proxying /api here).
// When `frontend/dist` exists (after `npm run build`), this same server also serves it directly —
// one process, one port, so a packaged app doesn't need two servers running to be usable.
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/health).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  logger.info("server.serving_frontend", { frontendDist });
}

app.listen(config.port, () => {
  logger.info("server.started", { port: config.port });
});
