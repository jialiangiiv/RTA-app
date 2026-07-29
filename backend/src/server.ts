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

app.listen(config.port, () => {
  logger.info("server.started", { port: config.port });
});
