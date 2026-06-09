import { Router } from "express";
import { asyncHandler, validateBody } from "../lib/http";
import { JobService, jobInputSchema, manualImportSchema } from "../services/job.service";
import {
  PublicJobImportService,
  publicJobImportAllSchema,
  publicJobImportSchema
} from "../services/public-job-import.service";

const router = Router();
const jobService = new JobService();
const publicJobImportService = new PublicJobImportService();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await jobService.list(req.query));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(jobInputSchema, req.body);
    res.status(201).json(await jobService.create(body));
  })
);

router.post(
  "/import-manual",
  asyncHandler(async (req, res) => {
    const body = validateBody(manualImportSchema, req.body);
    res.status(201).json(await jobService.importManual(body));
  })
);

router.post(
  "/import-public",
  asyncHandler(async (req, res) => {
    const body = validateBody(publicJobImportSchema, req.body);
    res.status(201).json(await publicJobImportService.importJobs(body));
  })
);

router.post(
  "/import-public/all",
  asyncHandler(async (req, res) => {
    const body = validateBody(publicJobImportAllSchema, req.body);
    res.status(201).json(await publicJobImportService.importAllJobs(body));
  })
);

router.post(
  "/rescore-all",
  asyncHandler(async (_req, res) => {
    res.json(await jobService.rescoreAll());
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await jobService.get(req.params.id));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = validateBody(jobInputSchema.partial(), req.body);
    res.json(await jobService.update(req.params.id, body));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await jobService.delete(req.params.id));
  })
);

router.post(
  "/:id/score",
  asyncHandler(async (req, res) => {
    res.json(await jobService.scoreAndPersist(req.params.id));
  })
);

export default router;
