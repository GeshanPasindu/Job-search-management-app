import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { AUTH_CONFIG } from "../lib/auth.config";
import { ApiError } from "../lib/http";

export class AuthService {
  async register(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await argon2.hash(password, AUTH_CONFIG.argon2Options);

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        passwordHash
      }
    });

    const tokens = await this.generateTokenPair(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name
      },
      ...tokens
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const tokens = await this.generateTokenPair(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name
      },
      ...tokens
    };
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!stored) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new ApiError(401, "Refresh token expired");
    }

    // Rotate: delete old token, issue new pair
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokenPair(stored.userId);

    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        firstName: stored.user.firstName,
        lastName: stored.user.lastName,
        name: stored.user.name
      },
      ...tokens
    };
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { success: true };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true
      }
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  private async generateTokenPair(userId: string) {
    const accessToken = jwt.sign(
      { sub: userId },
      AUTH_CONFIG.jwtSecret,
      { expiresIn: AUTH_CONFIG.accessTokenExpiry }
    );

    const refreshToken = crypto.randomBytes(64).toString("hex");

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + AUTH_CONFIG.refreshTokenExpiryMs)
      }
    });

    return { accessToken, refreshToken };
  }
}
