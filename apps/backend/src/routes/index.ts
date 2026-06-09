import { Router } from "express";
import applicationPackagesRoutes from "./application-packages.routes";
import applicationsRoutes from "./applications.routes";
import dashboardRoutes from "./dashboard.routes";
import emailRoutes from "./email.routes";
import jobsRoutes from "./jobs.routes";
import keywordsRoutes from "./keywords.routes";
import profileRoutes from "./profile.routes";
import sourcesRoutes from "./sources.routes";
import templatesRoutes from "./templates.routes";

const router = Router();

router.use("/dashboard", dashboardRoutes);
router.use("/email", emailRoutes);
router.use("/keywords", keywordsRoutes);
router.use("/sources", sourcesRoutes);
router.use("/jobs", jobsRoutes);
router.use("/templates", templatesRoutes);
router.use("/application-packages", applicationPackagesRoutes);
router.use("/applications", applicationsRoutes);
router.use("/profile", profileRoutes);

export default router;
