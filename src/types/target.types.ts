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
}

export interface TargetResponse {
  id: string;
  userId: string;
  companyName: string;
  role: string;
  companyEmail: string | null;
  websiteLink: string | null;
  createdAt: Date;
  updatedAt: Date;
}
