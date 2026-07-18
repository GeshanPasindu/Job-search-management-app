import { Router } from "express";
import { asyncHandler, validateBody } from "../lib/http";
import {
  ApplicationService,
  applicationInputSchema,
  applicationUpdateSchema
} from "../services/application.service";

const router = Router();
const applicationService = new ApplicationService();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await applicationService.list(req.user!.id, req.query));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(applicationInputSchema, req.body);
    res.status(201).json(await applicationService.create(req.user!.id, body));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = validateBody(applicationUpdateSchema, req.body);
    res.json(await applicationService.update(req.user!.id, req.params.id, body));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await applicationService.delete(req.user!.id, req.params.id));
  })
);

export default router;
