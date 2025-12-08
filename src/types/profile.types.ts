export interface CreateProfileInput {
  targetRole?: string;
  targetCompany?: string;
  level?: string;
}

export interface UpdateProfileInput {
  targetRole?: string;
  targetCompany?: string;
  level?: string;
}

export interface ProfileResponse {
  id: string;
  userId: string;
  targetRole: string | null;
  targetCompany: string | null;
  level: string | null;
  createdAt: Date;
  updatedAt: Date;
}
