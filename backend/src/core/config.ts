import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? "./data/rta-app.sqlite"),
};
