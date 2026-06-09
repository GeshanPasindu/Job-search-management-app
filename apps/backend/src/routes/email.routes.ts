import { Router } from "express";
import { asyncHandler, validateBody } from "../lib/http";
import {
  EmailJobImportService,
  emailJobImportSchema
} from "../services/email-job-import.service";

const router = Router();
const emailJobImportService = new EmailJobImportService();

router.get(
  "/gmail/status",
  asyncHandler(async (_req, res) => {
    res.json(emailJobImportService.getStatus());
  })
);

router.get(
  "/gmail/auth-url",
  asyncHandler(async (_req, res) => {
    res.json(emailJobImportService.getAuthUrl());
  })
);

router.get(
  "/gmail/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      res.status(400).send("Missing Gmail OAuth code.");
      return;
    }

    await emailJobImportService.handleCallback(code);
    res.send(`
      <!doctype html>
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>Gmail connected</h1>
          <p>You can close this tab and return to Job Search CRM.</p>
        </body>
      </html>
    `);
  })
);

router.post(
  "/job-alerts/import",
  asyncHandler(async (req, res) => {
    const body = validateBody(emailJobImportSchema, req.body);
    res.status(201).json(await emailJobImportService.importJobAlerts(body));
  })
);

export default router;
