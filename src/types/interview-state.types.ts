/**
 * Interview State Machine Types
 * Real-time interview state tracking for adaptive interviews
 */

// Round types (must match prisma enum)
export enum RoundType {
  BEHAVIORAL = 'BEHAVIORAL',
  TECHNICAL = 'TECHNICAL',
  CODING = 'CODING',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  HR = 'HR',
}

// Question difficulty levels
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

// Question categories for topic tracking
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

// Individual question state
export interface QuestionState {
  id: string;
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  askedAt: Date;
  answeredAt?: Date;
  answer?: string;
  score?: number; // 0-10
  feedback?: string;
  followUpAsked?: boolean;
  isFollowUp: boolean;
  parentQuestionId?: string;
  timeSpentSeconds?: number;
  metadata?: Record<string, unknown>;
}

// Topic coverage tracking
export interface TopicCoverage {
  category: QuestionCategory;
  questionsAsked: number;
  averageScore: number;
  covered: boolean; // Has at least one question been asked
  depth: 'shallow' | 'moderate' | 'deep'; // Based on follow-ups and score
}

// Rolling performance metrics
export interface PerformanceMetrics {
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
  recentScores: number[]; // Last 5 scores for trend
  scoreTrend: 'improving' | 'stable' | 'declining';
  strongAreas: QuestionCategory[];
  weakAreas: QuestionCategory[];
  suggestedDifficulty: Difficulty;
  confidenceLevel: 'low' | 'medium' | 'high'; // Based on pause metrics and expression
}

// Coding round specific state
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

// Main interview state
export interface InterviewState {
  // Identifiers
  id: string;
  interviewId: string;
  userId: string;
  sessionId?: string;
  
  // Round info
  roundType: RoundType;
  roundOrder: number;
  
  // Timing
  startedAt: Date;
  lastActivityAt: Date;
  estimatedDurationMinutes: number;
  elapsedSeconds: number;
  
  // Interview context
  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  resumeContext?: string; // Condensed resume info
  
  // Question tracking
  questions: QuestionState[];
  currentQuestionIndex: number;
  topicCoverage: Record<QuestionCategory, TopicCoverage>;
  
  // Performance
  performance: PerformanceMetrics;
  
  // Coding round (only populated for CODING round)
  codingState?: CodingState;
  
  // Interview flow control
  phase: InterviewPhase;
  canProceedToNext: boolean; // Ready for next question
  shouldWrapUp: boolean; // Time to conclude
  
  // Real-time signals (from frontend via WebSocket)
  candidateSignals: CandidateSignals;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  persistedAt?: Date; // Last time saved to Postgres
}

// Interview phases for flow control
export enum InterviewPhase {
  NOT_STARTED = 'not_started',
  INTRODUCTION = 'introduction',
  MAIN_QUESTIONS = 'main_questions',
  DEEP_DIVE = 'deep_dive', // Follow-up questions on specific topic
  CODING_SETUP = 'coding_setup', // Presenting coding problem
  CODING_ACTIVE = 'coding_active', // Candidate is coding
  CODING_REVIEW = 'coding_review', // Discussing code solution
  WRAP_UP = 'wrap_up',
  COMPLETED = 'completed',
}

// Real-time signals from candidate (via WebSocket)
export interface CandidateSignals {
  // From facial detection
  currentExpression?: string;
  expressionConfidence?: number;
  averageExpressions?: Record<string, number>;
  
  // From speech analysis (real-time)
  currentPauseSeconds?: number;
  longPauseDetected?: boolean;
  
  // From code editor (for coding rounds)
  isTyping?: boolean;
  lastCodeUpdate?: Date;
  codeLength?: number;
}

// State update payloads
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

// VAPI tool response types
export interface NextQuestionResponse {
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  context?: string; // Why this question was chosen
  isFollowUp: boolean;
  topicsRemaining: QuestionCategory[];
  estimatedQuestionsLeft: number;
}

export interface AnswerEvaluationResponse {
  score: number; // 0-10
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

// WebSocket events
export enum SocketEvent {
  // Server -> Client
  STATE_UPDATE = 'interview:state_update',
  QUESTION_ASKED = 'interview:question_asked',
  ANSWER_EVALUATED = 'interview:answer_evaluated',
  CODING_PROBLEM_ASSIGNED = 'interview:coding_problem_assigned',
  CODE_EXECUTED = 'interview:code_executed',
  HINT_PROVIDED = 'interview:hint_provided',
  PHASE_CHANGED = 'interview:phase_changed',
  INTERVIEW_COMPLETED = 'interview:completed',
  
  // Client -> Server
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
