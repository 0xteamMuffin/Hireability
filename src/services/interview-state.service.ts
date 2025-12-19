/**
 * Interview State Service
 * In-memory state machine with Postgres persistence for real-time adaptive interviews
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma.util';
import {
  InterviewState,
  QuestionState,
  TopicCoverage,
  PerformanceMetrics,
  CodingState,
  CandidateSignals,
  InterviewPhase,
  RoundType,
  Difficulty,
  QuestionCategory,
  AskQuestionPayload,
  RecordAnswerPayload,
  UpdateCodingStatePayload,
  InterviewStateSnapshot,
  CodeExecutionResult,
} from '../types/interview-state.types';

const stateStore = new Map<string, InterviewState>();

const PERSISTENCE_INTERVAL_MS = 30000;
const persistenceTimers = new Map<string, NodeJS.Timeout>();

const createDefaultTopicCoverage = (): Record<QuestionCategory, TopicCoverage> => ({
  [QuestionCategory.INTRODUCTION]: {
    category: QuestionCategory.INTRODUCTION,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.EXPERIENCE]: {
    category: QuestionCategory.EXPERIENCE,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.BEHAVIORAL]: {
    category: QuestionCategory.BEHAVIORAL,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.TECHNICAL_CONCEPT]: {
    category: QuestionCategory.TECHNICAL_CONCEPT,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.PROBLEM_SOLVING]: {
    category: QuestionCategory.PROBLEM_SOLVING,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.SYSTEM_DESIGN]: {
    category: QuestionCategory.SYSTEM_DESIGN,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.CODING]: {
    category: QuestionCategory.CODING,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.CULTURE_FIT]: {
    category: QuestionCategory.CULTURE_FIT,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
  [QuestionCategory.CLOSING]: {
    category: QuestionCategory.CLOSING,
    questionsAsked: 0,
    averageScore: 0,
    covered: false,
    depth: 'shallow',
  },
});

const createDefaultPerformance = (): PerformanceMetrics => ({
  totalQuestions: 0,
  answeredQuestions: 0,
  averageScore: 0,
  recentScores: [],
  scoreTrend: 'stable',
  strongAreas: [],
  weakAreas: [],
  suggestedDifficulty: Difficulty.MEDIUM,
  confidenceLevel: 'medium',
});

/**
 * Initialize a new interview state
 */
export const createInterviewState = async (params: {
  interviewId: string;
  userId: string;
  sessionId?: string;
  roundType: RoundType;
  roundOrder?: number;
  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  resumeContext?: string;
  estimatedDurationMinutes?: number;
}): Promise<InterviewState> => {
  const stateId = uuidv4();
  const now = new Date();

  const state: InterviewState = {
    id: stateId,
    interviewId: params.interviewId,
    userId: params.userId,
    sessionId: params.sessionId,
    roundType: params.roundType,
    roundOrder: params.roundOrder || 1,
    startedAt: now,
    lastActivityAt: now,
    estimatedDurationMinutes:
      params.estimatedDurationMinutes || getDefaultDuration(params.roundType),
    elapsedSeconds: 0,
    targetRole: params.targetRole,
    targetCompany: params.targetCompany,
    experienceLevel: params.experienceLevel,
    resumeContext: params.resumeContext,
    questions: [],
    currentQuestionIndex: -1,
    topicCoverage: createDefaultTopicCoverage(),
    performance: createDefaultPerformance(),
    phase: InterviewPhase.NOT_STARTED,
    canProceedToNext: true,
    shouldWrapUp: false,
    candidateSignals: {},
    createdAt: now,
    updatedAt: now,
  };

  stateStore.set(params.interviewId, state);

  startPersistenceTimer(params.interviewId);

  return state;
};

/**
 * Get interview state by interview ID
 */
export const getInterviewState = (interviewId: string): InterviewState | null => {
  return stateStore.get(interviewId) || null;
};

/**
 * Update interview phase
 */
export const setPhase = (interviewId: string, phase: InterviewPhase): InterviewState | null => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  state.phase = phase;
  state.lastActivityAt = new Date();
  state.updatedAt = new Date();

  return state;
};

/**
 * Record a question being asked
 */
export const recordQuestion = (
  interviewId: string,
  payload: AskQuestionPayload,
): QuestionState | null => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  const questionId = uuidv4();
  const question: QuestionState = {
    id: questionId,
    question: payload.question,
    category: payload.category,
    difficulty: payload.difficulty,
    askedAt: new Date(),
    isFollowUp: payload.isFollowUp || false,
    parentQuestionId: payload.parentQuestionId,
    metadata: payload.metadata,
  };

  state.questions.push(question);
  state.currentQuestionIndex = state.questions.length - 1;
  state.lastActivityAt = new Date();
  state.updatedAt = new Date();

  const topic = state.topicCoverage[payload.category];
  topic.questionsAsked++;
  topic.covered = true;
  if (topic.questionsAsked >= 2 && payload.isFollowUp) {
    topic.depth = 'deep';
  } else if (topic.questionsAsked >= 2) {
    topic.depth = 'moderate';
  }

  state.performance.totalQuestions++;

  return question;
};

/**
 * Record an answer and evaluation
 */
export const recordAnswer = (
  interviewId: string,
  payload: RecordAnswerPayload,
): QuestionState | null => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  const question = state.questions.find((q) => q.id === payload.questionId);
  if (!question) return null;

  const answeredAt = new Date();
  question.answer = payload.answer;
  question.answeredAt = answeredAt;
  question.score = payload.score;
  question.feedback = payload.feedback;
  question.followUpAsked = payload.suggestFollowUp;
  question.timeSpentSeconds = Math.floor(
    (answeredAt.getTime() - question.askedAt.getTime()) / 1000,
  );

  state.lastActivityAt = answeredAt;
  state.updatedAt = answeredAt;

  updatePerformanceMetrics(state, question);

  updateTopicCoverageScore(state, question);

  checkWrapUpConditions(state);

  return question;
};

/**
 * Update performance metrics after an answer
 */
const updatePerformanceMetrics = (state: InterviewState, question: QuestionState): void => {
  const perf = state.performance;

  perf.answeredQuestions++;

  if (question.score !== undefined) {
    perf.recentScores.push(question.score);
    if (perf.recentScores.length > 5) {
      perf.recentScores.shift();
    }
  }

  const totalScore = state.questions
    .filter((q) => q.score !== undefined)
    .reduce((sum, q) => sum + (q.score || 0), 0);
  perf.averageScore = perf.answeredQuestions > 0 ? totalScore / perf.answeredQuestions : 0;

  if (perf.recentScores.length >= 3) {
    const recent = perf.recentScores.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const prevAvg =
      perf.recentScores.slice(0, -3).reduce((a, b) => a + b, 0) /
      Math.max(1, perf.recentScores.length - 3);

    if (avg > prevAvg + 1) {
      perf.scoreTrend = 'improving';
    } else if (avg < prevAvg - 1) {
      perf.scoreTrend = 'declining';
    } else {
      perf.scoreTrend = 'stable';
    }
  }

  updateStrengthsAndWeaknesses(state);

  adjustSuggestedDifficulty(state);
};

/**
 * Update topic coverage score
 */
const updateTopicCoverageScore = (state: InterviewState, question: QuestionState): void => {
  const topic = state.topicCoverage[question.category];

  const questionsInCategory = state.questions.filter(
    (q) => q.category === question.category && q.score !== undefined,
  );

  const totalScore = questionsInCategory.reduce((sum, q) => sum + (q.score || 0), 0);
  topic.averageScore = questionsInCategory.length > 0 ? totalScore / questionsInCategory.length : 0;
};

/**
 * Update strong and weak areas based on topic scores
 */
const updateStrengthsAndWeaknesses = (state: InterviewState): void => {
  const perf = state.performance;
  const topicsWithScores = Object.entries(state.topicCoverage)
    .filter(([_, coverage]) => coverage.questionsAsked > 0 && coverage.averageScore > 0)
    .map(([category, coverage]) => ({
      category: category as QuestionCategory,
      score: coverage.averageScore,
    }));

  if (topicsWithScores.length === 0) return;

  const avgScore = topicsWithScores.reduce((sum, t) => sum + t.score, 0) / topicsWithScores.length;

  perf.strongAreas = topicsWithScores.filter((t) => t.score >= avgScore + 1).map((t) => t.category);

  perf.weakAreas = topicsWithScores.filter((t) => t.score <= avgScore - 1).map((t) => t.category);
};

/**
 * Adjust suggested difficulty based on performance
 */
const adjustSuggestedDifficulty = (state: InterviewState): void => {
  const perf = state.performance;
  const avgScore = perf.averageScore;
  const trend = perf.scoreTrend;

  if (avgScore >= 8 && trend !== 'declining') {
    perf.suggestedDifficulty = Difficulty.HARD;
  } else if (avgScore >= 6 || trend === 'improving') {
    perf.suggestedDifficulty = Difficulty.MEDIUM;
  } else if (avgScore < 5 && trend === 'declining') {
    perf.suggestedDifficulty = Difficulty.EASY;
  } else {
    perf.suggestedDifficulty = Difficulty.MEDIUM;
  }
};

/**
 * Check if interview should wrap up
 */
const checkWrapUpConditions = (state: InterviewState): void => {
  const elapsedMinutes = state.elapsedSeconds / 60;
  const questionsAsked = state.performance.totalQuestions;

  if (elapsedMinutes >= state.estimatedDurationMinutes * 0.9) {
    state.shouldWrapUp = true;
    return;
  }

  const minQuestions = getMinQuestionsForRound(state.roundType);
  if (questionsAsked >= minQuestions && state.performance.averageScore >= 5) {
    state.shouldWrapUp = true;
  }
};

/**
 * Update candidate signals (from WebSocket)
 */
export const updateCandidateSignals = (
  interviewId: string,
  signals: Partial<CandidateSignals>,
): InterviewState | null => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  state.candidateSignals = { ...state.candidateSignals, ...signals };
  state.lastActivityAt = new Date();

  updateConfidenceLevel(state);

  return state;
};

/**
 * Update confidence level based on candidate signals
 */
const updateConfidenceLevel = (state: InterviewState): void => {
  const signals = state.candidateSignals;
  const perf = state.performance;

  const avgExpressions = signals.averageExpressions;
  if (avgExpressions) {
    const positiveScore = (avgExpressions.happy || 0) + (avgExpressions.neutral || 0);
    const negativeScore =
      (avgExpressions.fearful || 0) + (avgExpressions.sad || 0) + (avgExpressions.angry || 0);

    if (positiveScore > 0.6 && negativeScore < 0.2) {
      perf.confidenceLevel = 'high';
    } else if (negativeScore > 0.4) {
      perf.confidenceLevel = 'low';
    } else {
      perf.confidenceLevel = 'medium';
    }
  }

  if (signals.longPauseDetected) {
    perf.confidenceLevel = 'low';
  }
};

/**
 * Initialize coding round state
 */
export const initializeCodingState = (
  interviewId: string,
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    starterCode: string;
    hints: string[];
    testCases: number;
  },
  language: string,
): CodingState | null => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  const codingState: CodingState = {
    problemId: problem.id,
    problemTitle: problem.title,
    problemDescription: problem.description,
    difficulty: problem.difficulty,
    language,
    currentCode: problem.starterCode,
    starterCode: problem.starterCode,
    hintsUsed: 0,
    hintsAvailable: problem.hints,
    testCasesPassed: 0,
    totalTestCases: problem.testCases,
    submissions: [],
    startedAt: new Date(),
    timeSpentSeconds: 0,
  };

  state.codingState = codingState;
  state.phase = InterviewPhase.CODING_SETUP;
  state.lastActivityAt = new Date();
  state.updatedAt = new Date();

  return codingState;
};

/**
 * Update coding state
 */
export const updateCodingState = (
  interviewId: string,
  payload: UpdateCodingStatePayload,
): CodingState | null => {
  const state = stateStore.get(interviewId);
  if (!state || !state.codingState) return null;

  const coding = state.codingState;

  if (payload.code !== undefined) {
    coding.currentCode = payload.code;
  }

  if (payload.language !== undefined) {
    coding.language = payload.language;
  }

  if (payload.hintUsed) {
    coding.hintsUsed++;
  }

  if (payload.executionResult) {
    coding.lastExecutionResult = payload.executionResult;

    if (payload.executionResult.testResults) {
      coding.testCasesPassed = payload.executionResult.testResults.filter((t) => t.passed).length;
    }
  }

  coding.timeSpentSeconds = Math.floor((new Date().getTime() - coding.startedAt.getTime()) / 1000);

  state.lastActivityAt = new Date();
  state.updatedAt = new Date();

  return coding;
};

/**
 * Record code submission
 */
export const recordCodeSubmission = (
  interviewId: string,
  code: string,
  language: string,
  result: CodeExecutionResult,
): CodingState | null => {
  const state = stateStore.get(interviewId);
  if (!state || !state.codingState) return null;

  const coding = state.codingState;

  coding.submissions.push({
    id: uuidv4(),
    code,
    language,
    submittedAt: new Date(),
    result,
  });

  coding.lastExecutionResult = result;
  if (result.testResults) {
    coding.testCasesPassed = result.testResults.filter((t) => t.passed).length;
  }

  state.lastActivityAt = new Date();
  state.updatedAt = new Date();

  return coding;
};

/**
 * Get state snapshot for VAPI tools
 */
export const getStateSnapshot = (interviewId: string): InterviewStateSnapshot | null => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  const coveredTopics = Object.entries(state.topicCoverage)
    .filter(([_, coverage]) => coverage.covered)
    .map(([category]) => category as QuestionCategory);

  const remainingTopics = Object.entries(state.topicCoverage)
    .filter(([_, coverage]) => !coverage.covered)
    .map(([category]) => category as QuestionCategory);

  return {
    phase: state.phase,
    questionsAsked: state.performance.totalQuestions,
    averageScore: Math.round(state.performance.averageScore * 10) / 10,
    topicsCovered: coveredTopics,
    topicsRemaining: remainingTopics,
    suggestedDifficulty: state.performance.suggestedDifficulty,
    timeElapsedMinutes: Math.round(state.elapsedSeconds / 60),
    shouldWrapUp: state.shouldWrapUp,
    codingProgress: state.codingState
      ? {
          problemTitle: state.codingState.problemTitle,
          testsPassed: state.codingState.testCasesPassed,
          totalTests: state.codingState.totalTestCases,
          hintsUsed: state.codingState.hintsUsed,
        }
      : undefined,
  };
};

/**
 * Update elapsed time
 */
export const updateElapsedTime = (interviewId: string): void => {
  const state = stateStore.get(interviewId);
  if (!state) return;

  state.elapsedSeconds = Math.floor((new Date().getTime() - state.startedAt.getTime()) / 1000);
};

/**
 * Complete interview
 */
export const completeInterview = async (interviewId: string): Promise<InterviewState | null> => {
  const state = stateStore.get(interviewId);
  if (!state) return null;

  state.phase = InterviewPhase.COMPLETED;
  state.updatedAt = new Date();
  updateElapsedTime(interviewId);

  await persistState(interviewId);

  stopPersistenceTimer(interviewId);

  return state;
};

/**
 * Persist state to Postgres
 */
export const persistState = async (interviewId: string): Promise<void> => {
  const state = stateStore.get(interviewId);
  if (!state) return;

  const dbInterviewId = interviewId || state.interviewId;
  if (!dbInterviewId) {
    console.warn(`[InterviewState] Cannot persist state - no valid interviewId`);
    return;
  }

  const db = prisma as any;

  try {
    await db.interview.update({
      where: { id: dbInterviewId },
      data: {
        contextPrompt: JSON.stringify({
          interviewState: {
            phase: state.phase,
            questionsAsked: state.questions.length,
            topicCoverage: state.topicCoverage,
            performance: state.performance,
            codingState: state.codingState,
          },
        }),
      },
    });

    state.persistedAt = new Date();
    console.log(`[InterviewState] Persisted state for interview ${dbInterviewId}`);
  } catch (error) {
    console.error(
      `[InterviewState] Failed to persist state for interview ${dbInterviewId}:`,
      error,
    );
  }
};

/**
 * Load state from Postgres (for recovery)
 */
export const loadState = async (interviewId: string): Promise<InterviewState | null> => {
  const memoryState = stateStore.get(interviewId);
  if (memoryState) return memoryState;

  const db = prisma as any;

  try {
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: { user: { include: { profile: true } } },
    });

    if (!interview) return null;

    let storedState: any = null;
    if (interview.contextPrompt) {
      try {
        const parsed = JSON.parse(interview.contextPrompt);
        storedState = parsed.interviewState;
      } catch {}
    }

    const state = await createInterviewState({
      interviewId,
      userId: interview.userId,
      sessionId: interview.sessionId,
      roundType: interview.roundType as RoundType,
      roundOrder: interview.roundOrder,
      targetRole: interview.user?.profile?.targetRole,
      targetCompany: interview.user?.profile?.targetCompany,
      experienceLevel: interview.user?.profile?.level,
    });

    if (storedState) {
      state.phase = storedState.phase || state.phase;
      state.topicCoverage = storedState.topicCoverage || state.topicCoverage;
      state.performance = storedState.performance || state.performance;
      state.codingState = storedState.codingState;
    }

    return state;
  } catch (error) {
    console.error(`[InterviewState] Failed to load state for interview ${interviewId}:`, error);
    return null;
  }
};

/**
 * Delete state from memory
 */
export const deleteState = (interviewId: string): void => {
  stopPersistenceTimer(interviewId);
  stateStore.delete(interviewId);
};

/**
 * Get all active interview IDs
 */
export const getActiveInterviews = (): string[] => {
  return Array.from(stateStore.keys());
};

const getDefaultDuration = (roundType: RoundType): number => {
  const durations: Record<RoundType, number> = {
    [RoundType.BEHAVIORAL]: 20,
    [RoundType.TECHNICAL]: 30,
    [RoundType.CODING]: 45,
    [RoundType.SYSTEM_DESIGN]: 45,
    [RoundType.HR]: 15,
  };
  return durations[roundType] || 30;
};

const getMinQuestionsForRound = (roundType: RoundType): number => {
  const minQuestions: Record<RoundType, number> = {
    [RoundType.BEHAVIORAL]: 4,
    [RoundType.TECHNICAL]: 5,
    [RoundType.CODING]: 1,
    [RoundType.SYSTEM_DESIGN]: 2,
    [RoundType.HR]: 3,
  };
  return minQuestions[roundType] || 4;
};

const startPersistenceTimer = (interviewId: string): void => {
  const timer = setInterval(() => {
    persistState(interviewId);
  }, PERSISTENCE_INTERVAL_MS);
  persistenceTimers.set(interviewId, timer);
};

const stopPersistenceTimer = (interviewId: string): void => {
  const timer = persistenceTimers.get(interviewId);
  if (timer) {
    clearInterval(timer);
    persistenceTimers.delete(interviewId);
  }
};
