import { Router } from "express";
import { z } from "zod";
import { asyncHandler, validateBody } from "../lib/http";
import { requireAuth } from "../lib/auth.middleware";
import { AuthService } from "../services/auth.service";

const router = Router();
const authService = new AuthService();

const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").trim(),
    lastName: z.string().min(1, "Last name is required").trim(),
    email: z.string().email("Invalid email address").trim().toLowerCase(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required")
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

// POST /api/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = validateBody(registerSchema, req.body);
    const result = await authService.register(
      body.firstName,
      body.lastName,
      body.email,
      body.password
    );
    res.status(201).json(result);
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = validateBody(loginSchema, req.body);
    const result = await authService.login(body.email, body.password);
    res.json(result);
  })
);

// POST /api/auth/refresh
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = validateBody(refreshSchema, req.body);
    const result = await authService.refresh(body.refreshToken);
    res.json(result);
  })
);

// POST /api/auth/logout
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const body = validateBody(refreshSchema, req.body);
    const result = await authService.logout(body.refreshToken);
    res.json(result);
  })
);

// GET /api/auth/me — protected
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.id);
    res.json(user);
  })
);

export default router;
