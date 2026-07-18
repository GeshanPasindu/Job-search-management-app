import crypto from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { asyncHandler, validateBody } from "../lib/http";
import { getUploadDir, toStoredFile } from "../lib/file-storage";
import {
  TemplateService,
  templateUpdateSchema,
  templateUploadSchema
} from "../services/template.service";

const router = Router();
const templateService = new TemplateService();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, getUploadDir()),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname);
    const safeName = file.originalname
      .replace(extension, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}-${safeName}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await templateService.list(req.user!.id));
  })
);

router.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const body = validateBody(templateUploadSchema, req.body);
    res.status(201).json(await templateService.create(req.user!.id, body, toStoredFile(req.file)));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await templateService.get(req.user!.id, req.params.id));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = validateBody(templateUpdateSchema, req.body);
    res.json(await templateService.update(req.user!.id, req.params.id, body));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await templateService.delete(req.user!.id, req.params.id));
  })
);

export default router;
