export const AUTH_CONFIG = {
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-in-production",
  accessTokenExpiry: "15m",
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  argon2Options: {
    type: 2 as const, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  }
};
