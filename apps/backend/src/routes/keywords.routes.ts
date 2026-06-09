import { Router } from "express";
import { asyncHandler, validateBody } from "../lib/http";
import { KeywordService, keywordCreateSchema, keywordUpdateSchema } from "../services/keyword.service";

const router = Router();
const keywordService = new KeywordService();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeDisabled = req.query.includeDisabled !== "false";
    res.json(await keywordService.list(includeDisabled));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(keywordCreateSchema, req.body);
    res.status(201).json(await keywordService.create(body));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = validateBody(keywordUpdateSchema, req.body);
    res.json(await keywordService.update(req.params.id, body));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await keywordService.delete(req.params.id));
  })
);

export default router;
