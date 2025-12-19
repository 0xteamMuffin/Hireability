import { prisma } from '../utils/prisma.util';
import { SaveTranscriptRequest } from '../types/transcript.types';

export const saveTranscript = async (userId: string, payload: SaveTranscriptRequest) => {
  const db = prisma as any;

  const interview = await db.interview.findFirst({
    where: { id: payload.interviewId, userId },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  return db.interviewTranscript.create({
    data: {
      userId,
      interviewId: payload.interviewId,
      assistantId: payload.assistantId || interview.assistantId || null,
      callId: payload.callId || interview.callId || null,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : (interview.startedAt ?? null),
      endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
      durationSeconds: payload.durationSeconds ?? null,
      transcript: payload.transcript,
    },
  });
};
