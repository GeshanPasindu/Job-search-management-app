export type EmailDraftInput = {
  to?: string;
  subject: string;
  body: string;
  attachments?: string[];
};

export interface EmailDraftService {
  createDraft(input: EmailDraftInput): Promise<{ draftId?: string; status: string }>;
}

export class ManualEmailDraftService implements EmailDraftService {
  async createDraft() {
    return {
      status: "manual_copy_only"
    };
  }
}
