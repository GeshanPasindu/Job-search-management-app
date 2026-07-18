import { getDefaultUser, prisma } from "../lib/prisma";

function countBy<T extends string | null>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item ?? "Unspecified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export class DashboardService {
  async stats() {
    const user = await getDefaultUser();
    const [jobs, applications, averageScore] = await Promise.all([
      prisma.job.findMany({
        where: { userId: user.id },
        orderBy: [{ createdAt: "desc" }]
      }),
      prisma.application.findMany({
        where: { userId: user.id },
        include: { job: true }
      }),
      prisma.job.aggregate({
        where: { userId: user.id },
        _avg: { score: true }
      })
    ]);

    const applicationsBySource = applications.reduce<Record<string, number>>((acc, application) => {
      const source = application.job.sourceName ?? application.job.sourceId ?? "Manual";
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalJobs: jobs.length,
      newJobs: jobs.filter((job) => job.status === "New").length,
      applied: jobs.filter((job) => job.status === "Applied").length,
      onProgress: jobs.filter((job) => job.status === "On-Progress").length,
      interviewed: jobs.filter((job) => job.status === "Interviewed").length,
      rejected: jobs.filter((job) => job.status === "Rejected").length,
      averageMatchScore: Math.round(averageScore._avg.score ?? 0),
      applicationsByStatus: countBy(applications.map((application) => application.status)),
      applicationsByRoleCategory: countBy(applications.map((application) => application.roleCategory)),
      applicationsBySource,
      recentJobs: jobs.slice(0, 8),
      highMatchJobs: jobs.filter((job) => job.score >= 70).slice(0, 8)
    };
  }
}
