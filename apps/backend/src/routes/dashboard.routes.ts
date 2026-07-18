import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { DashboardService } from "../services/dashboard.service";

const router = Router();
const dashboardService = new DashboardService();

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    res.json(await dashboardService.stats(req.user!.id));
  })
);

export default router;
