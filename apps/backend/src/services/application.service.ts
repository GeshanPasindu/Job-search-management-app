import { Prisma } from "@prisma/client";
import { z } from "zod";
import { jobStatuses } from "../domain/defaults";
import { ApiError, parseOptionalDate } from "../lib/http";
import { getDefaultUser, prisma } from "../lib/prisma";

export const applicationInputSchema = z.object({
  jobId: z.string().min(1),
  applicationPackageId: z.string().optional().nullable(),
  cvTemplateId: z.string().optional().nullable(),
  coverLetterTemplateId: z.string().optional().nullable(),
  status: z.enum(jobStatuses).default("Applied"),
  appliedDate: z.unknown().optional(),
  followUpDate: z.unknown().optional(),
  roleCategory: z.string().optional().nullable(),
  recruiterName: z.string().optional().nullable(),
  recruiterEmail: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
  interviewDates: z.array(z.string()).optional(),
  rejectionReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const applicationUpdateSchema = applicationInputSchema.partial();

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class ApplicationService {
  async list(query: Record<string, unknown>) {
    const user = await getDefaultUser();
    const where: Prisma.ApplicationWhereInput = { userId: user.id };
    if (query.status) where.status = String(query.status);
    if (query.roleCategory) where.roleCategory = String(query.roleCategory);

    return prisma.application.findMany({
      where,
      orderBy: [{ appliedDate: "desc" }, { createdAt: "desc" }],
      include: {
        job: true,
        applicationPackage: true,
        cvTemplate: true,
        coverLetterTemplate: true
      }
    });
  }

  async create(input: z.infer<typeof applicationInputSchema>) {
    const user = await getDefaultUser();
    const job = await prisma.job.findFirst({ where: { id: input.jobId, userId: user.id } });
    if (!job) {
      throw new ApiError(404, "Job was not found.");
    }

    const application = await prisma.application.create({
      data: {
        userId: user.id,
        jobId: input.jobId,
        applicationPackageId: emptyToNull(input.applicationPackageId),
        cvTemplateId: emptyToNull(input.cvTemplateId),
        coverLetterTemplateId: emptyToNull(input.coverLetterTemplateId),
        status: input.status,
        appliedDate: parseOptionalDate(input.appliedDate),
        followUpDate: parseOptionalDate(input.followUpDate),
        roleCategory: emptyToNull(input.roleCategory) ?? job.matchingCategory,
        recruiterName: emptyToNull(input.recruiterName),
        recruiterEmail: emptyToNull(input.recruiterEmail),
        salaryRange: emptyToNull(input.salaryRange),
        interviewDates: input.interviewDates ?? [],
        rejectionReason: emptyToNull(input.rejectionReason),
        notes: emptyToNull(input.notes)
      },
      include: { job: true, applicationPackage: true, cvTemplate: true, coverLetterTemplate: true }
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { status: input.status }
    });

    return application;
  }

  async update(id: string, input: z.infer<typeof applicationUpdateSchema>) {
    const user = await getDefaultUser();
    await this.ensureOwnedApplication(id, user.id);

    const application = await prisma.application.update({
      where: { id },
      data: {
        ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
        ...(input.applicationPackageId !== undefined
          ? { applicationPackageId: emptyToNull(input.applicationPackageId) }
          : {}),
        ...(input.cvTemplateId !== undefined ? { cvTemplateId: emptyToNull(input.cvTemplateId) } : {}),
        ...(input.coverLetterTemplateId !== undefined
          ? { coverLetterTemplateId: emptyToNull(input.coverLetterTemplateId) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.appliedDate !== undefined ? { appliedDate: parseOptionalDate(input.appliedDate) } : {}),
        ...(input.followUpDate !== undefined ? { followUpDate: parseOptionalDate(input.followUpDate) } : {}),
        ...(input.roleCategory !== undefined ? { roleCategory: emptyToNull(input.roleCategory) } : {}),
        ...(input.recruiterName !== undefined
          ? { recruiterName: emptyToNull(input.recruiterName) }
          : {}),
        ...(input.recruiterEmail !== undefined
          ? { recruiterEmail: emptyToNull(input.recruiterEmail) }
          : {}),
        ...(input.salaryRange !== undefined ? { salaryRange: emptyToNull(input.salaryRange) } : {}),
        ...(input.interviewDates !== undefined ? { interviewDates: input.interviewDates } : {}),
        ...(input.rejectionReason !== undefined
          ? { rejectionReason: emptyToNull(input.rejectionReason) }
          : {}),
        ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {})
      },
      include: { job: true, applicationPackage: true, cvTemplate: true, coverLetterTemplate: true }
    });

    if (input.status) {
      await prisma.job.update({
        where: { id: application.jobId },
        data: { status: input.status }
      });
    }

    return application;
  }

  async delete(id: string) {
    const user = await getDefaultUser();
    await this.ensureOwnedApplication(id, user.id);
    await prisma.application.delete({ where: { id } });
    return { id };
  }

  private async ensureOwnedApplication(id: string, userId: string) {
    const application = await prisma.application.findFirst({ where: { id, userId } });
    if (!application) {
      throw new ApiError(404, "Application was not found.");
    }
  }
}
