import { Prisma } from "@prisma/client";
import {
  defaultPreferredLocations,
  defaultPreferredRoles,
  defaultSkills
} from "../domain/defaults";
import { prisma } from "../lib/prisma";

export type ProfileUpdateInput = {
  summary?: string;
  preferredRoles?: string[];
  preferredLocations?: string[];
  salaryExpectation?: string | null;
  aiEnabled?: boolean;
  skills?: string[];
};

export class ProfileService {
  async ensureProfile(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        aiKeyConfigured: Boolean(process.env.AI_API_KEY)
      },
      create: {
        userId,
        summary:
          "Backend and cloud-focused engineer targeting integration, cloud support, implementation, solutions, and data/BI roles.",
        preferredRoles: defaultPreferredRoles,
        preferredLocations: defaultPreferredLocations,
        aiKeyConfigured: Boolean(process.env.AI_API_KEY)
      }
    });

    const skillCount = await prisma.skill.count({ where: { userId } });
    if (skillCount === 0) {
      await prisma.skill.createMany({
        data: defaultSkills.map((name, index) => ({
          userId,
          name,
          priority: defaultSkills.length - index
        })),
        skipDuplicates: true
      });
    }

    const skills = await prisma.skill.findMany({
      where: { userId },
      orderBy: [{ priority: "desc" }, { name: "asc" }]
    });

    return { user, profile, skills };
  }

  async get(userId: string) {
    const { user, profile, skills } = await this.ensureProfile(userId);
    return {
      user,
      profile,
      skills
    };
  }

  async update(userId: string, input: ProfileUpdateInput) {
    const { user } = await this.ensureProfile(userId);

    const updateData: Prisma.UserProfileUpdateInput = {};
    if (input.summary !== undefined) updateData.summary = input.summary;
    if (input.preferredRoles !== undefined) updateData.preferredRoles = input.preferredRoles;
    if (input.preferredLocations !== undefined) {
      updateData.preferredLocations = input.preferredLocations;
    }
    if (input.salaryExpectation !== undefined) {
      updateData.salaryExpectation = input.salaryExpectation;
    }
    if (input.aiEnabled !== undefined) updateData.aiEnabled = input.aiEnabled;
    updateData.aiKeyConfigured = Boolean(process.env.AI_API_KEY);

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: updateData
    });

    if (input.skills) {
      const skills = input.skills;
      await prisma.$transaction(async (tx) => {
        await tx.skill.deleteMany({
          where: {
            userId: user.id,
            name: { notIn: skills }
          }
        });

        for (const [index, name] of skills.entries()) {
          await tx.skill.upsert({
            where: { userId_name: { userId: user.id, name } },
            update: { priority: skills.length - index },
            create: {
              userId: user.id,
              name,
              priority: skills.length - index
            }
          });
        }
      });
    }

    return this.get(userId);
  }
}
