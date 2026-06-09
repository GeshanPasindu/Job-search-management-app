import { Router } from "express";
import { z } from "zod";
import { asyncHandler, validateBody } from "../lib/http";
import { SourceService } from "../services/source.service";

const router = Router();
const sourceService = new SourceService();

const testUrlSchema = z
  .object({
    sourceId: z.string().min(1),
    filters: z.record(z.unknown()).optional()
  })
  .passthrough();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await sourceService.list());
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await sourceService.update(req.params.id, req.body));
  })
);

router.post(
  "/test-url",
  asyncHandler(async (req, res) => {
    const body = validateBody(testUrlSchema, req.body);
    const { sourceId, filters, ...topLevelFilters } = body;
    res.json(await sourceService.testUrl(sourceId, filters ?? topLevelFilters));
  })
);

export default router;
