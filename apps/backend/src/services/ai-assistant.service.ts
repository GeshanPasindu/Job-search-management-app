export type ApplicationAssistantContext = {
  jobTitle: string;
  company: string;
  roleCategory: string;
  matchedSkills: string[];
  missingSkills: string[];
  profileSummary: string;
  cvSummary: string;
  coverLetterTemplate: string;
};

export type AiApplicationResult = {
  cvSummarySuggestion: string;
  coverLetterText: string;
  emailBody: string;
};

export interface AiApplicationAssistant {
  isConfigured(): boolean;
  improveApplicationPackage(context: ApplicationAssistantContext): Promise<AiApplicationResult | null>;
}

export class DisabledAiApplicationAssistant implements AiApplicationAssistant {
  isConfigured() {
    return Boolean(process.env.AI_API_KEY);
  }

  async improveApplicationPackage(
    _context: ApplicationAssistantContext
  ): Promise<AiApplicationResult | null> {
    return null;
  }
}
