/**
 * Session Service
 * Manages interview sessions with multi-round support
 */

import { prisma } from '../utils/prisma.util';
import {
  RoundType,
  InterviewStatus,
  SessionStatus,
  CreateSessionRequest,
  SessionResponse,
  RoundResponse,
  StartRoundRequest,
  CompleteRoundRequest,
  DEFAULT_ROUND_CONFIGS,
} from '../types/round.types';

const db = prisma as any;

/**
 * Check if user has multi-round mode enabled
 */
export const isMultiRoundEnabled = async (userId: string): Promise<boolean> => {
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });

  return settings?.multiRoundEnabled ?? true;
};

/**
 * Check if prerequisites are enabled (round locking)
 */
export const isPrerequisitesEnabled = async (userId: string): Promise<boolean> => {
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });

  return settings?.prerequisitesEnabled ?? true;
};

/**
 * Level-based default rounds configuration
 * Customized based on user's experience level from their profile
 */
const LEVEL_DEFAULT_ROUNDS: Record<string, RoundType[]> = {
  Intern: [RoundType.BEHAVIORAL, RoundType.TECHNICAL],
  'Junior (SDE I)': [RoundType.BEHAVIORAL, RoundType.TECHNICAL, RoundType.CODING],

  'Mid-Level (SDE II)': [RoundType.BEHAVIORAL, RoundType.TECHNICAL, RoundType.CODING],

  'Senior (SDE III)': [
    RoundType.BEHAVIORAL,
    RoundType.TECHNICAL,
    RoundType.SYSTEM_DESIGN,
    RoundType.CODING,
  ],

  'Staff Engineer': [
    RoundType.BEHAVIORAL,
    RoundType.TECHNICAL,
    RoundType.SYSTEM_DESIGN,
    RoundType.CODING,
    RoundType.HR,
  ],
  'Engineering Manager': [
    RoundType.BEHAVIORAL,
    RoundType.TECHNICAL,
    RoundType.SYSTEM_DESIGN,
    RoundType.HR,
  ],
};

/**
 * Get user's default rounds configuration
 * Priority: 1) User settings, 2) Level-based defaults, 3) Fallback
 */
export const getUserDefaultRounds = async (userId: string): Promise<RoundType[]> => {
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });

  if (settings?.defaultRounds?.length) {
    return settings.defaultRounds as RoundType[];
  }

  const profile = await db.userProfile.findUnique({
    where: { userId },
  });

  if (profile?.level && LEVEL_DEFAULT_ROUNDS[profile.level]) {
    return LEVEL_DEFAULT_ROUNDS[profile.level];
  }

  return [RoundType.BEHAVIORAL, RoundType.TECHNICAL, RoundType.CODING];
};

/**
 * Create a new interview session with rounds
 */
export const createSession = async (
  userId: string,
  payload: CreateSessionRequest,
): Promise<SessionResponse> => {
  const multiRoundEnabled = await isMultiRoundEnabled(userId);
  const prerequisitesEnabled = await isPrerequisitesEnabled(userId);

  let roundTypes: RoundType[];
  if (payload.rounds?.length) {
    const validRoundTypes = Object.values(RoundType);
    const invalidRounds = payload.rounds.filter((r) => !validRoundTypes.includes(r));
    if (invalidRounds.length > 0) {
      throw new Error(
        `Invalid round types: ${invalidRounds.join(', ')}. Valid types: ${validRoundTypes.join(', ')}`,
      );
    }
    roundTypes = payload.rounds;
  } else if (multiRoundEnabled) {
    roundTypes = await getUserDefaultRounds(userId);
  } else {
    roundTypes = [RoundType.TECHNICAL];
  }

  const session = await db.interviewSession.create({
    data: {
      userId,
      targetId: payload.targetId || null,
      status: SessionStatus.IN_PROGRESS,
      currentRound: 1,
      totalRounds: roundTypes.length,
    },
  });

  const roundsData = roundTypes.map((type, index) => {
    const order = index + 1;

    const isLocked = prerequisitesEnabled ? order > 1 : false;

    return {
      sessionId: session.id,
      roundType: type,
      order,
      status: InterviewStatus.NOT_STARTED,
      isLocked,
    };
  });

  await db.interviewRound.createMany({
    data: roundsData,
  });

  return getSession(userId, session.id);
};

/**
 * Delete an interview session and all its rounds/interviews
 */
export const deleteSession = async (userId: string, sessionId: string): Promise<void> => {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: { rounds: true },
  });

  if (!session) {
    throw new Error('Session not found or does not belong to user');
  }

  const interviewIds = session.rounds.map((r: any) => r.interviewId).filter(Boolean);

  if (interviewIds.length > 0) {
    await db.interview.deleteMany({
      where: {
        id: { in: interviewIds },
        userId,
      },
    });
  }

  await db.interviewSession.delete({
    where: { id: sessionId },
  });
};

/**
 * Get session by ID with all rounds
 */
export const getSession = async (userId: string, sessionId: string): Promise<SessionResponse> => {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      rounds: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  return formatSessionResponse(session);
};

/**
 * Get all sessions for user
 */
export const getSessions = async (userId: string): Promise<SessionResponse[]> => {
  const sessions = await db.interviewSession.findMany({
    where: { userId },
    include: {
      rounds: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map(formatSessionResponse);
};

/**
 * Get active (in-progress) session for user
 */
export const getActiveSession = async (userId: string): Promise<SessionResponse | null> => {
  const session = await db.interviewSession.findFirst({
    where: {
      userId,
      status: SessionStatus.IN_PROGRESS,
    },
    include: {
      rounds: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return session ? formatSessionResponse(session) : null;
};

/**
 * Start a specific round
 */
export const startRound = async (
  userId: string,
  payload: StartRoundRequest,
): Promise<RoundResponse> => {
  const session = await db.interviewSession.findFirst({
    where: { id: payload.sessionId, userId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const round = await db.interviewRound.findFirst({
    where: { id: payload.roundId, sessionId: payload.sessionId },
  });

  if (!round) {
    throw new Error('Round not found');
  }

  const prerequisitesEnabled = await isPrerequisitesEnabled(userId);
  if (prerequisitesEnabled && round.isLocked) {
    throw new Error('Round is locked. Complete previous rounds first.');
  }

  if (
    round.status !== InterviewStatus.NOT_STARTED &&
    round.status !== InterviewStatus.IN_PROGRESS
  ) {
    throw new Error('Round has already been completed');
  }

  const updatedRound = await db.interviewRound.update({
    where: { id: round.id },
    data: {
      status: InterviewStatus.IN_PROGRESS,
    },
  });

  await db.interviewSession.update({
    where: { id: session.id },
    data: { currentRound: round.order },
  });

  return formatRoundResponse(updatedRound);
};

/**
 * Complete a round and unlock next
 */
export const completeRound = async (
  userId: string,
  payload: CompleteRoundRequest,
): Promise<SessionResponse> => {
  const session = await db.interviewSession.findFirst({
    where: { id: payload.sessionId, userId },
    include: { rounds: { orderBy: { order: 'asc' } } },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const round = session.rounds.find((r: any) => r.id === payload.roundId);

  if (!round) {
    throw new Error('Round not found');
  }

  await db.interviewRound.update({
    where: { id: round.id },
    data: {
      status: InterviewStatus.COMPLETED,
      interviewId: payload.interviewId || null,
    },
  });

  const nextRound = session.rounds.find((r: any) => r.order === round.order + 1);
  if (nextRound) {
    await db.interviewRound.update({
      where: { id: nextRound.id },
      data: { isLocked: false },
    });
  }

  const allCompleted = session.rounds.every(
    (r: any) => r.id === round.id || r.status === InterviewStatus.COMPLETED,
  );

  if (allCompleted) {
    await db.interviewSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  return getSession(userId, session.id);
};

/**
 * Skip a round (if allowed)
 */
export const skipRound = async (
  userId: string,
  sessionId: string,
  roundId: string,
): Promise<SessionResponse> => {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: { rounds: { orderBy: { order: 'asc' } } },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const round = session.rounds.find((r: any) => r.id === roundId);

  if (!round) {
    throw new Error('Round not found');
  }

  const config = DEFAULT_ROUND_CONFIGS.find((c) => c.type === round.roundType);
  if (config?.isRequired) {
    throw new Error('This round is required and cannot be skipped');
  }

  await db.interviewRound.update({
    where: { id: round.id },
    data: { status: InterviewStatus.SKIPPED },
  });

  const nextRound = session.rounds.find((r: any) => r.order === round.order + 1);
  if (nextRound) {
    await db.interviewRound.update({
      where: { id: nextRound.id },
      data: { isLocked: false },
    });
  }

  return getSession(userId, session.id);
};

/**
 * Abandon a session
 */
export const abandonSession = async (
  userId: string,
  sessionId: string,
): Promise<SessionResponse> => {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  await db.interviewSession.update({
    where: { id: session.id },
    data: { status: SessionStatus.ABANDONED },
  });

  return getSession(userId, sessionId);
};

function formatSessionResponse(session: any): SessionResponse {
  return {
    id: session.id,
    userId: session.userId,
    targetId: session.targetId,
    status: session.status as SessionStatus,
    currentRound: session.currentRound,
    totalRounds: session.totalRounds,
    completedAt: session.completedAt,
    createdAt: session.createdAt,
    rounds: session.rounds?.map(formatRoundResponse) || [],
  };
}

function formatRoundResponse(round: any): RoundResponse {
  return {
    id: round.id,
    sessionId: round.sessionId,
    interviewId: round.interviewId,
    roundType: round.roundType as RoundType,
    order: round.order,
    status: round.status as InterviewStatus,
    isLocked: round.isLocked,
    problemId: round.problemId,
    codeSubmission: round.codeSubmission,
    codeLanguage: round.codeLanguage,
    createdAt: round.createdAt,
  };
}
