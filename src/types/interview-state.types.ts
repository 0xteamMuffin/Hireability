/**
 * Interview State Machine Types
 * Real-time interview state tracking for adaptive interviews
 */

export enum RoundType {
  BEHAVIORAL = 'BEHAVIORAL',
  TECHNICAL = 'TECHNICAL',
  CODING = 'CODING',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  HR = 'HR',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum QuestionCategory {
  INTRODUCTION = 'introduction',
  EXPERIENCE = 'experience',
  BEHAVIORAL = 'behavioral',
  TECHNICAL_CONCEPT = 'technical_concept',
  PROBLEM_SOLVING = 'problem_solving',
  SYSTEM_DESIGN = 'system_design',
  CODING = 'coding',
  CULTURE_FIT = 'culture_fit',
  CLOSING = 'closing',
}

export interface QuestionState {
  id: string;
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  askedAt: Date;
  answeredAt?: Date;
  answer?: string;
  score?: number;
  feedback?: string;
  followUpAsked?: boolean;
  isFollowUp: boolean;
  parentQuestionId?: string;
  timeSpentSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface TopicCoverage {
  category: QuestionCategory;
  questionsAsked: number;
  averageScore: number;
  covered: boolean;
  depth: 'shallow' | 'moderate' | 'deep';
}

export interface PerformanceMetrics {
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
  recentScores: number[];
  scoreTrend: 'improving' | 'stable' | 'declining';
  strongAreas: QuestionCategory[];
  weakAreas: QuestionCategory[];
  suggestedDifficulty: Difficulty;
  confidenceLevel: 'low' | 'medium' | 'high';
}

export interface CodingState {
  problemId: string;
  problemTitle: string;
  problemDescription: string;
  difficulty: Difficulty;
  language: string;
  currentCode: string;
  starterCode: string;
  hintsUsed: number;
  hintsAvailable: string[];
  testCasesPassed: number;
  totalTestCases: number;
  lastExecutionResult?: CodeExecutionResult;
  submissions: CodeSubmission[];
  startedAt: Date;
  timeSpentSeconds: number;
}

export interface CodeSubmission {
  id: string;
  code: string;
  language: string;
  submittedAt: Date;
  result: CodeExecutionResult;
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  testResults?: TestCaseResult[];
  executionTimeMs?: number;
  memoryUsedKb?: number;
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  executionTimeMs?: number;
}

export interface InterviewState {
  id: string;
  interviewId: string;
  userId: string;
  sessionId?: string;

  roundType: RoundType;
  roundOrder: number;

  startedAt: Date;
  lastActivityAt: Date;
  estimatedDurationMinutes: number;
  elapsedSeconds: number;

  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  resumeContext?: string;

  questions: QuestionState[];
  currentQuestionIndex: number;
  topicCoverage: Record<QuestionCategory, TopicCoverage>;

  performance: PerformanceMetrics;

  codingState?: CodingState;

  phase: InterviewPhase;
  canProceedToNext: boolean;
  shouldWrapUp: boolean;

  candidateSignals: CandidateSignals;

  createdAt: Date;
  updatedAt: Date;
  persistedAt?: Date;
}

export enum InterviewPhase {
  NOT_STARTED = 'not_started',
  INTRODUCTION = 'introduction',
  MAIN_QUESTIONS = 'main_questions',
  DEEP_DIVE = 'deep_dive',
  CODING_SETUP = 'coding_setup',
  CODING_ACTIVE = 'coding_active',
  CODING_REVIEW = 'coding_review',
  WRAP_UP = 'wrap_up',
  COMPLETED = 'completed',
}

export interface CandidateSignals {
  currentExpression?: string;
  expressionConfidence?: number;
  averageExpressions?: Record<string, number>;

  currentPauseSeconds?: number;
  longPauseDetected?: boolean;

  isTyping?: boolean;
  lastCodeUpdate?: Date;
  codeLength?: number;
}

export interface AskQuestionPayload {
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  isFollowUp?: boolean;
  parentQuestionId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordAnswerPayload {
  questionId: string;
  answer: string;
  score: number;
  feedback: string;
  suggestFollowUp?: boolean;
}

export interface UpdateCodingStatePayload {
  code?: string;
  language?: string;
  hintUsed?: boolean;
  executionResult?: CodeExecutionResult;
}

export interface NextQuestionResponse {
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  context?: string;
  isFollowUp: boolean;
  topicsRemaining: QuestionCategory[];
  estimatedQuestionsLeft: number;
}

export interface AnswerEvaluationResponse {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  suggestFollowUp: boolean;
  followUpQuestion?: string;
  topicMastery: 'novice' | 'intermediate' | 'proficient' | 'expert';
}

export interface InterviewStateSnapshot {
  phase: InterviewPhase;
  questionsAsked: number;
  averageScore: number;
  topicsCovered: QuestionCategory[];
  topicsRemaining: QuestionCategory[];
  suggestedDifficulty: Difficulty;
  timeElapsedMinutes: number;
  shouldWrapUp: boolean;
  codingProgress?: {
    problemTitle: string;
    testsPassed: number;
    totalTests: number;
    hintsUsed: number;
  };
}

export enum SocketEvent {
  STATE_UPDATE = 'interview:state_update',
  QUESTION_ASKED = 'interview:question_asked',
  ANSWER_EVALUATED = 'interview:answer_evaluated',
  CODING_PROBLEM_ASSIGNED = 'interview:coding_problem_assigned',
  CODE_EXECUTED = 'interview:code_executed',
  HINT_PROVIDED = 'interview:hint_provided',
  PHASE_CHANGED = 'interview:phase_changed',
  INTERVIEW_COMPLETED = 'interview:completed',

  JOIN_INTERVIEW = 'interview:join',
  LEAVE_INTERVIEW = 'interview:leave',
  CODE_UPDATE = 'interview:code_update',
  EXPRESSION_UPDATE = 'interview:expression_update',
  REQUEST_STATE = 'interview:request_state',
}

export interface SocketPayloads {
  [SocketEvent.STATE_UPDATE]: InterviewStateSnapshot;
  [SocketEvent.QUESTION_ASKED]: { question: QuestionState };
  [SocketEvent.ANSWER_EVALUATED]: AnswerEvaluationResponse;
  [SocketEvent.CODING_PROBLEM_ASSIGNED]: { problem: CodingState };
  [SocketEvent.CODE_EXECUTED]: CodeExecutionResult;
  [SocketEvent.HINT_PROVIDED]: { hint: string; hintsRemaining: number };
  [SocketEvent.PHASE_CHANGED]: { phase: InterviewPhase; reason: string };
  [SocketEvent.INTERVIEW_COMPLETED]: { summary: InterviewStateSnapshot };

  [SocketEvent.JOIN_INTERVIEW]: { interviewId: string; userId: string };
  [SocketEvent.LEAVE_INTERVIEW]: { interviewId: string };
  [SocketEvent.CODE_UPDATE]: { code: string; language: string };
  [SocketEvent.EXPRESSION_UPDATE]: { expression: string; confidence: number };
  [SocketEvent.REQUEST_STATE]: { interviewId: string };
}
