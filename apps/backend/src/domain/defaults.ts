export const roleCategories = [
  "Integration",
  "Cloud",
  "Implementation",
  "Solutions",
  "Data/BI",
  "Software Engineering"
] as const;

export const jobStatuses = [
  "New",
  "Shortlisted",
  "Applying",
  "Applied",
  "Interview",
  "Rejected",
  "On Hold",
  "Archived"
] as const;

export const defaultKeywords = [
  { keyword: "Integration Engineer", category: "Integration", priority: 100, notes: "Primary target role" },
  { keyword: "API Integration Engineer", category: "Integration", priority: 98, notes: "Strong API fit" },
  { keyword: "Technical Implementation Engineer", category: "Implementation", priority: 95, notes: "Implementation and integration" },
  { keyword: "Implementation Consultant", category: "Implementation", priority: 90, notes: "Customer-facing implementation" },
  { keyword: "Functional Consultant", category: "Implementation", priority: 78, notes: "Keep technical fit in view" },
  { keyword: "Cloud Support Engineer", category: "Cloud", priority: 88, notes: "Production support and cloud troubleshooting" },
  { keyword: "Cloud Operations Engineer", category: "Cloud", priority: 86, notes: "Operations and AWS fit" },
  { keyword: "Junior Cloud Engineer", category: "Cloud", priority: 80, notes: "Entry-level cloud track" },
  { keyword: "Associate Solutions Engineer", category: "Solutions", priority: 84, notes: "Pre-sales adjacent, technical only" },
  { keyword: "Technical Solutions Engineer", category: "Solutions", priority: 82, notes: "Technical problem solving" },
  { keyword: "Data Integration Analyst", category: "Data/BI", priority: 75, notes: "SQL and integration overlap" },
  { keyword: "BI Implementation Analyst", category: "Data/BI", priority: 70, notes: "BI implementation" },
  { keyword: "Analytics Implementation Analyst", category: "Data/BI", priority: 68, notes: "Analytics implementation" },
  { keyword: "Software Engineer", category: "Software Engineering", priority: 92, notes: "General software engineering role" },
  { keyword: "Junior Software Engineer", category: "Software Engineering", priority: 90, notes: "Junior software engineering target" },
  { keyword: "Associate Software Engineer", category: "Software Engineering", priority: 88, notes: "Associate-level software engineering target" },
  { keyword: "Full Stack Software Engineer", category: "Software Engineering", priority: 86, notes: "Frontend/backend product engineering role" },
  { keyword: "Backend Software Engineer", category: "Software Engineering", priority: 86, notes: "Backend-heavy software role" },
  { keyword: "Node.js Developer", category: "Software Engineering", priority: 84, notes: "Node.js backend role" },
  { keyword: "TypeScript Developer", category: "Software Engineering", priority: 82, notes: "TypeScript-focused software role" },
  { keyword: "React Developer", category: "Software Engineering", priority: 74, notes: "React role; review for backend/API overlap" }
];

export const defaultSkills = [
  "Node.js",
  "Express.js",
  "NestJS",
  "TypeScript",
  "JavaScript",
  "React",
  "Angular",
  "REST APIs",
  "API integration",
  "authentication flows",
  "JWT",
  "AWS Lambda",
  "S3",
  "Cognito",
  "DynamoDB",
  "SES",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Git",
  "GitHub",
  "Azure DevOps",
  "debugging",
  "production troubleshooting"
];

export const defaultPreferredRoles = [
  "Integration Engineer",
  "API Integration Engineer",
  "Cloud Support Engineer",
  "Cloud Operations Engineer",
  "Technical Implementation Engineer",
  "Application Consultant",
  "Functional Consultant",
  "Solutions Engineer",
  "Data Integration Analyst",
  "BI Implementation Analyst",
  "Analytics Implementation Analyst",
  "Software Engineer",
  "Junior Software Engineer",
  "Associate Software Engineer",
  "Full Stack Software Engineer",
  "Backend Software Engineer",
  "Node.js Developer",
  "TypeScript Developer"
];

export const defaultPreferredLocations = [
  "Sri Lanka",
  "Colombo",
  "Remote",
  "Worldwide",
  "Dubai",
  "Singapore"
];

export const defaultCoverLetterTemplate = `Dear Hiring Team,

I am writing to apply for the {{jobTitle}} role at {{company}}. My background is strongest in {{roleCategory}} work where I can use {{matchedSkills}} to connect systems, support users, and troubleshoot production issues.

For this role, I would emphasize {{myRelevantExperience}}. I also noticed these areas to review before applying: {{missingSkills}}.

Thank you for considering my application.

Best regards,
{{candidateName}}`;
