import { prisma } from '../utils/prisma.util';
import { StartInterviewRequest, SaveAnalysisRequest } from '../types/interview.types';

export const createInterview = async (userId: string, payload: StartInterviewRequest) => {
  const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();

  const db = prisma as any; // cast until Prisma types are regenerated

  return db.interview.create({
    data: {
      userId,
      assistantId: payload.assistantId || null,
      callId: payload.callId || null,
      startedAt,
      contextPrompt: payload.contextPrompt || null,
    },
  });
};

export const saveAnalysis = async (userId: string, payload: SaveAnalysisRequest) => {
  const db = prisma as any; // cast until Prisma types are regenerated

  const interview = await db.interview.findFirst({
    where: { id: payload.interviewId, userId },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  return db.interviewAnalysis.upsert({
    where: { interviewId: payload.interviewId },
    update: {
      technical: payload.technical ?? undefined,
      problemSolving: payload.problemSolving ?? undefined,
      communication: payload.communication ?? undefined,
      roleKnowledge: payload.roleKnowledge ?? undefined,
      experience: payload.experience ?? undefined,
      professional: payload.professional ?? undefined,
      overall: payload.overall ?? undefined,
      modelVersion: payload.modelVersion ?? undefined,
    },
    create: {
      interviewId: payload.interviewId,
      technical: payload.technical ?? null,
      problemSolving: payload.problemSolving ?? null,
      communication: payload.communication ?? null,
      roleKnowledge: payload.roleKnowledge ?? null,
      experience: payload.experience ?? null,
      professional: payload.professional ?? null,
      overall: payload.overall ?? null,
      modelVersion: payload.modelVersion ?? null,
    },
  });
};

