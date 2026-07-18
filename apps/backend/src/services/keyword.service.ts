import { z } from "zod";
import { ApiError } from "../lib/http";
import { prisma } from "../lib/prisma";

export const keywordCreateSchema = z.object({
  keyword: z.string().min(1),
  category: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().default(0),
  notes: z.string().optional().nullable()
});

export const keywordUpdateSchema = keywordCreateSchema.partial();

export class KeywordService {
  async list(userId: string, includeDisabled = true) {
    return prisma.keyword.findMany({
      where: {
        userId,
        ...(includeDisabled ? {} : { enabled: true })
      },
      orderBy: [{ enabled: "desc" }, { priority: "desc" }, { keyword: "asc" }]
    });
  }

  async create(userId: string, input: z.infer<typeof keywordCreateSchema>) {
    return prisma.keyword.create({
      data: {
        ...input,
        userId
      }
    });
  }

  async update(userId: string, id: string, input: z.infer<typeof keywordUpdateSchema>) {
    await this.ensureOwnedKeyword(id, userId);
    return prisma.keyword.update({
      where: { id },
      data: input
    });
  }

  async delete(userId: string, id: string) {
    await this.ensureOwnedKeyword(id, userId);
    await prisma.keyword.delete({ where: { id } });
    return { id };
  }

  private async ensureOwnedKeyword(id: string, userId: string) {
    const keyword = await prisma.keyword.findFirst({ where: { id, userId } });
    if (!keyword) {
      throw new ApiError(404, "Keyword was not found.");
    }
  }
}
