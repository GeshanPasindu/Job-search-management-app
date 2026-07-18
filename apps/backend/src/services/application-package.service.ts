import { z } from "zod";
import { defaultCoverLetterTemplate } from "../domain/defaults";
import { ApiError } from "../lib/http";
import { prisma } from "../lib/prisma";
import {
  AiApplicationAssistant,
  ApplicationAssistantContext,
  DisabledAiApplicationAssistant
} from "./ai-assistant.service";
import { TemplateService } from "./template.service";

export const generateApplicationPackageSchema = z.object({
  jobId: z.string().min(1),
  cvTemplateId: z.string().optional().nullable(),
  coverLetterTemplateId: z.string().optional().nullable(),
  roleCategory: z.string().optional().nullable()
});

export const updateApplicationPackageSchema = z.object({
  cvSummarySuggestion: z.string().optional(),
  skillsOrderingSuggestion: z.array(z.string()).optional(),
  coverLetterText: z.string().optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  checklist: z.array(z.string()).optional()
});

type GenerateInput = z.infer<typeof generateApplicationPackageSchema>;

function listText(values: string[], fallback: string) {
  return values.length > 0 ? values.join(", ") : fallback;
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/{{\s*([\w]+)\s*}}/g, (_match, key: string) => variables[key] ?? "");
}

export class ApplicationPackageService {
  private templateService = new TemplateService();
  private aiAssistant: AiApplicationAssistant = new DisabledAiApplicationAssistant();

  async generate(userId: string, input: GenerateInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [job, profile] = await Promise.all([
      prisma.job.findFirst({ where: { id: input.jobId, userId } }),
      prisma.userProfile.findUnique({ where: { userId } })
    ]);

    if (!job) {
      throw new ApiError(404, "Job was not found.");
    }

    const roleCategory = input.roleCategory ?? job.matchingCategory ?? "Integration";
    const cvTemplate = input.cvTemplateId
      ? await prisma.cvTemplate.findFirst({ where: { id: input.cvTemplateId, userId } })
      : await this.templateService.findDefaultCv(userId, roleCategory);
    const coverLetterTemplate = input.coverLetterTemplateId
      ? await prisma.coverLetterTemplate.findFirst({
          where: { id: input.coverLetterTemplateId, userId }
        })
      : await this.templateService.findDefaultCoverLetter(userId, roleCategory);

    const matchedSkillsText = listText(job.matchedSkills, "the relevant skills in my profile");
    const missingSkillsText = listText(job.missingSkills, "no major gaps identified from the pasted posting");
    const profileSummary = profile?.summary ?? "";
    const cvSummary = cvTemplate?.summaryText ?? profileSummary;
    const myRelevantExperience =
      cvSummary ||
      `hands-on work with ${matchedSkillsText}, focused on practical implementation and troubleshooting`;

    const variables = {
      jobTitle: job.title,
      company: job.company,
      roleCategory,
      matchedSkills: matchedSkillsText,
      missingSkills: missingSkillsText,
      myRelevantExperience,
      source: job.sourceName ?? job.sourceId ?? "manual import",
      applyUrl: job.applyUrl ?? job.jobUrl ?? "",
      today: todayText(),
      candidateName: user.name
    };

    const baseCoverLetter = renderTemplate(
      coverLetterTemplate?.content || defaultCoverLetterTemplate,
      variables
    );
    const skillsOrderingSuggestion = this.orderSkills(job.matchedSkills, cvTemplate?.skillsPriorityList ?? []);
    const cvSummarySuggestion =
      cvSummary ||
      `Emphasize ${matchedSkillsText} for this ${roleCategory} role at ${job.company}.`;
    const emailSubject = `Application for ${job.title} - ${user.name}`;
    const emailBody = [
      `Dear Hiring Team,`,
      "",
      `Please find my application for the ${job.title} role at ${job.company}.`,
      `I have highlighted my relevant experience around ${matchedSkillsText}.`,
      "",
      "Best regards,",
      user.name
    ].join("\n");

    const context: ApplicationAssistantContext = {
      jobTitle: job.title,
      company: job.company,
      roleCategory,
      matchedSkills: job.matchedSkills,
      missingSkills: job.missingSkills,
      profileSummary,
      cvSummary,
      coverLetterTemplate: coverLetterTemplate?.content || defaultCoverLetterTemplate
    };
    const aiResult = this.aiAssistant.isConfigured()
      ? await this.aiAssistant.improveApplicationPackage(context)
      : null;

    return prisma.applicationPackage.create({
      data: {
        userId,
        jobId: job.id,
        cvTemplateId: cvTemplate?.id,
        coverLetterTemplateId: coverLetterTemplate?.id,
        roleCategory,
        cvSummarySuggestion: aiResult?.cvSummarySuggestion ?? cvSummarySuggestion,
        skillsOrderingSuggestion,
        coverLetterText: aiResult?.coverLetterText ?? baseCoverLetter,
        emailSubject,
        emailBody: aiResult?.emailBody ?? emailBody,
        checklist: [
          "Confirm the company name, job title, and recruiter details before sending.",
          "Only keep claims backed by your profile, CV, or real project experience.",
          "Review missing skills and frame them honestly as learning areas when needed.",
          "Attach the intended CV version and cover letter version.",
          "Open the apply link manually and submit yourself."
        ],
        aiUsed: Boolean(aiResult)
      },
      include: {
        job: true,
        cvTemplate: true,
        coverLetterTemplate: true
      }
    });
  }

  async get(userId: string, id: string) {
    const applicationPackage = await prisma.applicationPackage.findFirst({
      where: { id, userId },
      include: { job: true, cvTemplate: true, coverLetterTemplate: true }
    });
    if (!applicationPackage) {
      throw new ApiError(404, "Application package was not found.");
    }

    return applicationPackage;
  }

  async update(userId: string, id: string, input: z.infer<typeof updateApplicationPackageSchema>) {
    await this.get(userId, id);
    return prisma.applicationPackage.update({
      where: { id },
      data: input,
      include: { job: true, cvTemplate: true, coverLetterTemplate: true }
    });
  }

  private orderSkills(matchedSkills: string[], prioritySkills: string[]) {
    const ordered = [
      ...prioritySkills.filter((skill) => matchedSkills.includes(skill)),
      ...matchedSkills.filter((skill) => !prioritySkills.includes(skill)),
      ...prioritySkills.filter((skill) => !matchedSkills.includes(skill))
    ];

    return Array.from(new Set(ordered));
  }
}
