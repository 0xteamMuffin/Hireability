import { prisma } from '../utils/prisma.util';
import { CreateProfileInput, UpdateProfileInput } from '../types/profile.types';

export interface ProfileResponse {
  id: string;
  userId: string;
  targetRole: string | null;
  targetCompany: string | null;
  level: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const getProfile = async (userId: string): Promise<ProfileResponse | null> => {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
    targetRole: profile.targetRole,
    targetCompany: profile.targetCompany,
    level: profile.level,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

export const upsertProfile = async (
  userId: string,
  data: CreateProfileInput | UpdateProfileInput,
): Promise<ProfileResponse> => {
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      targetRole: data.targetRole,
      targetCompany: data.targetCompany,
      level: data.level,
    },
    update: {
      targetRole: data.targetRole,
      targetCompany: data.targetCompany,
      level: data.level,
    },
  });

  return {
    id: profile.id,
    userId: profile.userId,
    targetRole: profile.targetRole,
    targetCompany: profile.targetCompany,
    level: profile.level,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};
