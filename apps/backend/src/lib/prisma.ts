import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

export async function getDefaultUser() {
  const email = process.env.DEFAULT_USER_EMAIL ?? "owner@example.local";
  const name = process.env.DEFAULT_USER_NAME ?? "Job Search Owner";

  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name }
  });
}
