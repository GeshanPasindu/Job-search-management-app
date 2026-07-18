import { Router } from "express";
import { requireAuth } from "../lib/auth.middleware";
import applicationPackagesRoutes from "./application-packages.routes";
import applicationsRoutes from "./applications.routes";
import authRoutes from "./auth.routes";
import dashboardRoutes from "./dashboard.routes";
import emailRoutes from "./email.routes";
import jobsRoutes from "./jobs.routes";
import keywordsRoutes from "./keywords.routes";
import profileRoutes from "./profile.routes";
import sourcesRoutes from "./sources.routes";
import templatesRoutes from "./templates.routes";

const router = Router();

// Public routes (no auth required)
router.use("/auth", authRoutes);

// Protected routes (require auth)
router.use("/dashboard", requireAuth, dashboardRoutes);
router.use("/email", requireAuth, emailRoutes);
router.use("/keywords", requireAuth, keywordsRoutes);
router.use("/sources", requireAuth, sourcesRoutes);
router.use("/jobs", requireAuth, jobsRoutes);
router.use("/templates", requireAuth, templatesRoutes);
router.use("/application-packages", requireAuth, applicationPackagesRoutes);
router.use("/applications", requireAuth, applicationsRoutes);
router.use("/profile", requireAuth, profileRoutes);

export default router;
