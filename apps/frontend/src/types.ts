export type RoleCategory =
  | "Integration"
  | "Cloud"
  | "Implementation"
  | "Solutions"
  | "Data/BI"
  | "Software Engineering";

export type JobStatus =
  | "New"
  | "Applied"
  | "On-Progress"
  | "Interviewed"
  | "Rejected";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type Keyword = {
  id: string;
  keyword: string;
  category: string;
  enabled: boolean;
  priority: number;
  notes?: string | null;
};

export type SourceConfig = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  baseUrl?: string;
  supportsFilters?: Record<string, boolean>;
  queryParams?: Record<string, string>;
  filterMappings?: Record<string, Record<string, string>>;
  importConfig?: Record<string, unknown>;
  applyMode: string;
};

export type Job = {
  id: string;
  sourceId?: string | null;
  sourceName?: string | null;
  title: string;
  company: string;
  location?: string | null;
  workplaceType?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  applyEmail?: string | null;
  description: string;
  salaryText?: string | null;
  seniority?: string | null;
  jobType?: string | null;
  postedDate?: string | null;
  deadline?: string | null;
  score: number;
  scoreLabel: string;
  scoreExplanation: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchingCategory?: string | null;
  status: JobStatus | string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CvTemplate = {
  id: string;
  roleCategory: string;
  versionName: string;
  originalFileName?: string | null;
  summaryText: string;
  skillsPriorityList: string[];
  isDefault: boolean;
  notes?: string | null;
};

export type CoverLetterTemplate = {
  id: string;
  roleCategory: string;
  versionName: string;
  originalFileName?: string | null;
  content: string;
  isDefault: boolean;
  notes?: string | null;
};

export type TemplateList = {
  cvTemplates: CvTemplate[];
  coverLetterTemplates: CoverLetterTemplate[];
};

export type ApplicationPackage = {
  id: string;
  jobId: string;
  roleCategory: string;
  cvSummarySuggestion: string;
  skillsOrderingSuggestion: string[];
  coverLetterText: string;
  emailSubject: string;
  emailBody: string;
  checklist: string[];
  aiUsed: boolean;
  generatedAt: string;
  job?: Job;
  cvTemplate?: CvTemplate | null;
  coverLetterTemplate?: CoverLetterTemplate | null;
};

export type Application = {
  id: string;
  jobId: string;
  applicationPackageId?: string | null;
  cvTemplateId?: string | null;
  coverLetterTemplateId?: string | null;
  status: string;
  appliedDate?: string | null;
  followUpDate?: string | null;
  roleCategory?: string | null;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  salaryRange?: string | null;
  interviewDates: string[];
  rejectionReason?: string | null;
  notes?: string | null;
  job?: Job;
  applicationPackage?: ApplicationPackage | null;
  cvTemplate?: CvTemplate | null;
  coverLetterTemplate?: CoverLetterTemplate | null;
};

export type DashboardStats = {
  totalJobs: number;
  newJobs: number;
  applied: number;
  onProgress: number;
  interviewed: number;
  rejected: number;
  averageMatchScore: number;
  applicationsByStatus: Record<string, number>;
  applicationsByRoleCategory: Record<string, number>;
  applicationsBySource: Record<string, number>;
  recentJobs: Job[];
  highMatchJobs: Job[];
};

export type ProfileResponse = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  profile: {
    summary: string;
    preferredRoles: string[];
    preferredLocations: string[];
    salaryExpectation?: string | null;
    aiEnabled: boolean;
    aiKeyConfigured: boolean;
  };
  skills: Array<{
    id: string;
    name: string;
    category?: string | null;
    priority: number;
  }>;
};
