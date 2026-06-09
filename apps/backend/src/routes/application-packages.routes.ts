import { Router } from "express";
import { asyncHandler, validateBody } from "../lib/http";
import {
  ApplicationPackageService,
  generateApplicationPackageSchema,
  updateApplicationPackageSchema
} from "../services/application-package.service";

const router = Router();
const applicationPackageService = new ApplicationPackageService();

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const body = validateBody(generateApplicationPackageSchema, req.body);
    res.status(201).json(await applicationPackageService.generate(body));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await applicationPackageService.get(req.params.id));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = validateBody(updateApplicationPackageSchema, req.body);
    res.json(await applicationPackageService.update(req.params.id, body));
  })
);

export default router;
