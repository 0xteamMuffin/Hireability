import { prisma } from '../utils/prisma.util';
import { CreateTargetInput, UpdateTargetInput, TargetResponse } from '../types/target.types';

export const getTargets = async (userId: string): Promise<TargetResponse[]> => {
  const targets = await prisma.targetCompany.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return targets.map((target) => ({
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  }));
};

export const getTargetById = async (id: string, userId: string): Promise<TargetResponse | null> => {
  const target = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!target) return null;

  return {
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
};

export const createTarget = async (
  userId: string,
  data: CreateTargetInput,
): Promise<TargetResponse> => {
  const target = await prisma.targetCompany.create({
    data: {
      userId,
      companyName: data.companyName,
      role: data.role,
      companyEmail: data.companyEmail,
      websiteLink: data.websiteLink,
    },
  });

  return {
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
};

export const updateTarget = async (
  id: string,
  userId: string,
  data: UpdateTargetInput,
): Promise<TargetResponse | null> => {
  const existing = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!existing) return null;

  const target = await prisma.targetCompany.update({
    where: { id },
    data: {
      companyName: data.companyName,
      role: data.role,
      companyEmail: data.companyEmail,
      websiteLink: data.websiteLink,
    },
  });

  return {
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
};

export const deleteTarget = async (id: string, userId: string): Promise<boolean> => {
  const existing = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!existing) return false;

  await prisma.targetCompany.delete({
    where: { id },
  });

  return true;
};
