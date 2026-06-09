import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import routes from "./routes";
import { errorMiddleware } from "./lib/http";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: corsOrigin.split(",").map((origin) => origin.trim())
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(process.env.UPLOAD_DIR ?? "uploads"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "job-search-crm-api" });
});

app.use("/api", routes);
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Job Search CRM API listening on http://localhost:${port}`);
});
