import type { JobStatus, RoleCategory } from "./types";

export const roleCategories: RoleCategory[] = [
  "Integration",
  "Cloud",
  "Implementation",
  "Solutions",
  "Data/BI",
  "Software Engineering"
];

export const jobStatuses: JobStatus[] = [
  "New",
  "Applied",
  "On-Progress",
  "Interviewed",
  "Rejected"
];

export const preferredLocations = [
  "Sri Lanka",
  "Colombo",
  "Remote",
  "Worldwide",
  "Dubai",
  "Singapore"
];

export const workplaceTypes = ["any", "remote", "onsite", "hybrid"];
export const datePostedOptions = ["any", "past24h", "pastWeek", "pastMonth"];
export const experienceLevels = ["any", "internship", "entryLevel", "associate"];
