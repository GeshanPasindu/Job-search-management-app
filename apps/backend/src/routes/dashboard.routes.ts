import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { DashboardService } from "../services/dashboard.service";

const router = Router();
const dashboardService = new DashboardService();

router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    res.json(await dashboardService.stats());
  })
);

export default router;
