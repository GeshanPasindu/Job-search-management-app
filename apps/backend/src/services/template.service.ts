import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, parseStringList } from "../lib/http";
import { prisma } from "../lib/prisma";
import { StoredFile } from "../lib/file-storage";

const templateTypeSchema = z.union([z.literal("cv"), z.literal("coverLetter"), z.literal("cover-letter")]);

export const templateUploadSchema = z.object({
  type: templateTypeSchema,
  roleCategory: z.string().min(1),
  versionName: z.string().min(1).default("Default"),
  summaryText: z.string().optional(),
  skillsPriorityList: z.unknown().optional(),
  content: z.string().optional(),
  isDefault: z.union([z.boolean(), z.string()]).optional(),
  notes: z.string().optional().nullable()
});

export const templateUpdateSchema = z.object({
  roleCategory: z.string().optional(),
  versionName: z.string().optional(),
  summaryText: z.string().optional(),
  skillsPriorityList: z.unknown().optional(),
  content: z.string().optional(),
  isDefault: z.union([z.boolean(), z.string()]).optional(),
  notes: z.string().optional().nullable()
});

export type TemplateUploadInput = z.infer<typeof templateUploadSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

function parseBoolean(value: unknown) {
  if ( typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }

  return false;
}

function normalizeTemplateType(type: z.infer<typeof templateTypeSchema>) {
  return type === "cover-letter" ? "coverLetter" : type;
}

function readEditableTemplateFile(storedFile: StoredFile) {
  if (!storedFile.filePath) return "";
  const extension = path.extname(storedFile.filePath).toLowerCase();
  if (![".txt", ".md", ".html"].includes(extension)) return "";
  if (!fs.existsSync(storedFile.filePath)) return "";

  return fs.readFileSync(storedFile.filePath, "utf8");
}

export class TemplateService {
  async list(userId: string) {
    const [cvTemplates, coverLetterTemplates] = await Promise.all([
      prisma.cvTemplate.findMany({
        where: { userId },
        orderBy: [{ roleCategory: "asc" }, { isDefault: "desc" }, { updatedAt: "desc" }]
      }),
      prisma.coverLetterTemplate.findMany({
        where: { userId },
        orderBy: [{ roleCategory: "asc" }, { isDefault: "desc" }, { updatedAt: "desc" }]
      })
    ]);

    return { cvTemplates, coverLetterTemplates };
  }

  async create(userId: string, input: TemplateUploadInput, storedFile: StoredFile = {}) {
    const type = normalizeTemplateType(input.type);
    const isDefault = parseBoolean(input.isDefault);

    if (type === "cv") {
      if (isDefault) {
        await prisma.cvTemplate.updateMany({
          where: { userId, roleCategory: input.roleCategory },
          data: { isDefault: false }
        });
      }

      return prisma.cvTemplate.create({
        data: {
          userId,
          roleCategory: input.roleCategory,
          versionName: input.versionName,
          summaryText: input.summaryText ?? "",
          skillsPriorityList: parseStringList(input.skillsPriorityList),
          isDefault,
          notes: input.notes,
          ...storedFile
        }
      });
    }

    if (isDefault) {
      await prisma.coverLetterTemplate.updateMany({
        where: { userId, roleCategory: input.roleCategory },
        data: { isDefault: false }
      });
    }

    return prisma.coverLetterTemplate.create({
      data: {
        userId,
        roleCategory: input.roleCategory,
        versionName: input.versionName,
        content: input.content || readEditableTemplateFile(storedFile),
        isDefault,
        notes: input.notes,
        ...storedFile
      }
    });
  }

  async get(userId: string, id: string) {
    const cvTemplate = await prisma.cvTemplate.findFirst({ where: { id, userId } });
    if (cvTemplate) {
      return { type: "cv" as const, template: cvTemplate };
    }

    const coverLetterTemplate = await prisma.coverLetterTemplate.findFirst({
      where: { id, userId }
    });
    if (coverLetterTemplate) {
      return { type: "coverLetter" as const, template: coverLetterTemplate };
    }

    throw new ApiError(404, "Template was not found.");
  }

  async update(userId: string, id: string, input: TemplateUpdateInput) {
    const existing = await this.get(userId, id);

    if (existing.type === "cv") {
      const roleCategory = input.roleCategory ?? existing.template.roleCategory;
      if (parseBoolean(input.isDefault)) {
        await prisma.cvTemplate.updateMany({
          where: { userId, roleCategory, id: { not: id } },
          data: { isDefault: false }
        });
      }

      const data: Prisma.CvTemplateUpdateInput = {
        ...(input.roleCategory !== undefined ? { roleCategory: input.roleCategory } : {}),
        ...(input.versionName !== undefined ? { versionName: input.versionName } : {}),
        ...(input.summaryText !== undefined ? { summaryText: input.summaryText } : {}),
        ...(input.skillsPriorityList !== undefined
          ? { skillsPriorityList: parseStringList(input.skillsPriorityList) }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: parseBoolean(input.isDefault) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {})
      };

      return prisma.cvTemplate.update({ where: { id }, data });
    }

    const roleCategory = input.roleCategory ?? existing.template.roleCategory;
    if (parseBoolean(input.isDefault)) {
      await prisma.coverLetterTemplate.updateMany({
        where: { userId, roleCategory, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const data: Prisma.CoverLetterTemplateUpdateInput = {
      ...(input.roleCategory !== undefined ? { roleCategory: input.roleCategory } : {}),
      ...(input.versionName !== undefined ? { versionName: input.versionName } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.isDefault !== undefined ? { isDefault: parseBoolean(input.isDefault) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {})
    };

    return prisma.coverLetterTemplate.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    const existing = await this.get(userId, id);
    if (existing.type === "cv") {
      await prisma.cvTemplate.delete({ where: { id } });
    } else {
      await prisma.coverLetterTemplate.delete({ where: { id } });
    }

    return { id };
  }

  async findDefaultCv(userId: string, roleCategory: string) {
    return prisma.cvTemplate.findFirst({
      where: { userId, roleCategory },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
  }

  async findDefaultCoverLetter(userId: string, roleCategory: string) {
    return prisma.coverLetterTemplate.findFirst({
      where: { userId, roleCategory },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
  }
}
