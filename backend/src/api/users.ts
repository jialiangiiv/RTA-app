import { Router } from "express";
import { usersService } from "../services/usersService";

export const usersRouter = Router();

usersRouter.get("/", (_req, res) => {
  res.json(usersService.list());
});

usersRouter.post("/", (req, res) => {
  const { display_name } = req.body;
  if (!display_name) return res.status(400).json({ error: "display_name is required" });
  res.status(201).json(usersService.create({ display_name }));
});
