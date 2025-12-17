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
 * Get user's default rounds configuration
 */
export const getUserDefaultRounds = async (userId: string): Promise<RoundType[]> => {
  const settings = await db.userSettings.findUnique({
    where: { userId },
  });
  
  if (settings?.defaultRounds?.length) {
    return settings.defaultRounds as RoundType[];
  }
  
  return [RoundType.BEHAVIORAL, RoundType.TECHNICAL];
};

/**
 * Create a new interview session with rounds
 */
export const createSession = async (
  userId: string,
  payload: CreateSessionRequest
): Promise<SessionResponse> => {
  const multiRoundEnabled = await isMultiRoundEnabled(userId);
  
  // Get rounds to create
  let roundTypes: RoundType[];
  if (payload.rounds?.length) {
    roundTypes = payload.rounds;
  } else if (multiRoundEnabled) {
    roundTypes = await getUserDefaultRounds(userId);
  } else {
    // Single round mode - just behavioral/technical combined
    roundTypes = [RoundType.TECHNICAL];
  }
  
  // Create session
  const session = await db.interviewSession.create({
    data: {
      userId,
      targetId: payload.targetId || null,
      status: SessionStatus.IN_PROGRESS,
      currentRound: 1,
      totalRounds: roundTypes.length,
    },
  });
  
  // Create rounds
  const roundsData = roundTypes.map((type, index) => {
    const order = index + 1;
    
    // First round is always unlocked, others depend on prerequisites
    const isLocked = order > 1;
    
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
  
  // Fetch complete session with rounds
  return getSession(userId, session.id);
};

/**
 * Get session by ID with all rounds
 */
export const getSession = async (
  userId: string,
  sessionId: string
): Promise<SessionResponse> => {
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
  payload: StartRoundRequest
): Promise<RoundResponse> => {
  // Verify session ownership
  const session = await db.interviewSession.findFirst({
    where: { id: payload.sessionId, userId },
  });
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get the round
  const round = await db.interviewRound.findFirst({
    where: { id: payload.roundId, sessionId: payload.sessionId },
  });
  
  if (!round) {
    throw new Error('Round not found');
  }
  
  if (round.isLocked) {
    throw new Error('Round is locked. Complete previous rounds first.');
  }
  
  if (round.status !== InterviewStatus.NOT_STARTED) {
    throw new Error('Round has already been started or completed');
  }
  
  // Update round status
  const updatedRound = await db.interviewRound.update({
    where: { id: round.id },
    data: {
      status: InterviewStatus.IN_PROGRESS,
    },
  });
  
  // Update session current round
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
  payload: CompleteRoundRequest
): Promise<SessionResponse> => {
  // Verify session ownership
  const session = await db.interviewSession.findFirst({
    where: { id: payload.sessionId, userId },
    include: { rounds: { orderBy: { order: 'asc' } } },
  });
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get the round
  const round = session.rounds.find((r: any) => r.id === payload.roundId);
  
  if (!round) {
    throw new Error('Round not found');
  }
  
  // Update round status
  await db.interviewRound.update({
    where: { id: round.id },
    data: {
      status: InterviewStatus.COMPLETED,
      interviewId: payload.interviewId || null,
    },
  });
  
  // Unlock next round if exists
  const nextRound = session.rounds.find((r: any) => r.order === round.order + 1);
  if (nextRound) {
    await db.interviewRound.update({
      where: { id: nextRound.id },
      data: { isLocked: false },
    });
  }
  
  // Check if all rounds completed
  const allCompleted = session.rounds.every(
    (r: any) => r.id === round.id || r.status === InterviewStatus.COMPLETED
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
  roundId: string
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
  
  // Check if round can be skipped (only non-required rounds)
  const config = DEFAULT_ROUND_CONFIGS.find(c => c.type === round.roundType);
  if (config?.isRequired) {
    throw new Error('This round is required and cannot be skipped');
  }
  
  // Update round status
  await db.interviewRound.update({
    where: { id: round.id },
    data: { status: InterviewStatus.SKIPPED },
  });
  
  // Unlock next round
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
  sessionId: string
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

// Helper formatters
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
