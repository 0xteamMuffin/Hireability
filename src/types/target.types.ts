export interface CreateTargetInput {
  companyName: string;
  role: string;
  companyEmail?: string;
  websiteLink?: string;
}

export interface UpdateTargetInput {
  companyName?: string;
  role?: string;
  companyEmail?: string;
  websiteLink?: string;
  scrapedContent?: string;
  scrapedAt?: Date;
}

export interface TargetResponse {
  id: string;
  userId: string;
  companyName: string;
  role: string;
  companyEmail: string | null;
  websiteLink: string | null;
  scrapedContent: string | null;
  scrapedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
