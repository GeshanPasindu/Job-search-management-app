import { z } from "zod";
import { ApiError } from "../lib/http";
import { getDefaultUser, prisma } from "../lib/prisma";

export const keywordCreateSchema = z.object({
  keyword: z.string().min(1),
  category: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().default(0),
  notes: z.string().optional().nullable()
});

export const keywordUpdateSchema = keywordCreateSchema.partial();

export class KeywordService {
  async list(includeDisabled = true) {
    const user = await getDefaultUser();
    return prisma.keyword.findMany({
      where: {
        userId: user.id,
        ...(includeDisabled ? {} : { enabled: true })
      },
      orderBy: [{ enabled: "desc" }, { priority: "desc" }, { keyword: "asc" }]
    });
  }

  async create(input: z.infer<typeof keywordCreateSchema>) {
    const user = await getDefaultUser();
    return prisma.keyword.create({
      data: {
        ...input,
        userId: user.id
      }
    });
  }

  async update(id: string, input: z.infer<typeof keywordUpdateSchema>) {
    const user = await getDefaultUser();
    await this.ensureOwnedKeyword(id, user.id);
    return prisma.keyword.update({
      where: { id },
      data: input
    });
  }

  async delete(id: string) {
    const user = await getDefaultUser();
    await this.ensureOwnedKeyword(id, user.id);
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
