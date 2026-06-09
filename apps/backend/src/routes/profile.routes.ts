import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseStringList, validateBody } from "../lib/http";
import { ProfileService } from "../services/profile.service";

const router = Router();
const profileService = new ProfileService();

const profileUpdateSchema = z.object({
  summary: z.string().optional(),
  preferredRoles: z.unknown().optional(),
  preferredLocations: z.unknown().optional(),
  salaryExpectation: z.string().optional().nullable(),
  aiEnabled: z.boolean().optional(),
  skills: z.unknown().optional()
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await profileService.get());
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(profileUpdateSchema, req.body);
    res.json(
      await profileService.update({
        ...body,
        preferredRoles:
          body.preferredRoles !== undefined ? parseStringList(body.preferredRoles) : undefined,
        preferredLocations:
          body.preferredLocations !== undefined ? parseStringList(body.preferredLocations) : undefined,
        skills: body.skills !== undefined ? parseStringList(body.skills) : undefined
      })
    );
  })
);

export default router;
