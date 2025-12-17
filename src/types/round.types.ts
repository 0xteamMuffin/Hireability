/**
 * Interview Round System Types
 * Supports multi-round interviews with prerequisites and progression
 */

export enum RoundType {
  BEHAVIORAL = 'BEHAVIORAL',
  TECHNICAL = 'TECHNICAL',
  CODING = 'CODING',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  HR = 'HR',
}

export enum InterviewStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export enum SessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export interface RoundConfig {
  type: RoundType;
  order: number;
  isRequired: boolean;
  prerequisites?: RoundType[];  // Rounds that must be completed first
  estimatedDuration?: number;   // In minutes
}

export const DEFAULT_ROUND_CONFIGS: RoundConfig[] = [
  {
    type: RoundType.BEHAVIORAL,
    order: 1,
    isRequired: true,
    prerequisites: [],
    estimatedDuration: 15,
  },
  {
    type: RoundType.TECHNICAL,
    order: 2,
    isRequired: true,
    prerequisites: [RoundType.BEHAVIORAL],
    estimatedDuration: 25,
  },
  {
    type: RoundType.CODING,
    order: 3,
    isRequired: false,
    prerequisites: [RoundType.TECHNICAL],
    estimatedDuration: 30,
  },
];

export interface CreateSessionRequest {
  targetId?: string;
  rounds?: RoundType[];  // Custom round selection, uses defaults if not provided
}

export interface SessionResponse {
  id: string;
  userId: string;
  targetId: string | null;
  status: SessionStatus;
  currentRound: number;
  totalRounds: number;
  completedAt: Date | null;
  createdAt: Date;
  rounds: RoundResponse[];
}

export interface RoundResponse {
  id: string;
  sessionId: string;
  interviewId: string | null;
  roundType: RoundType;
  order: number;
  status: InterviewStatus;
  isLocked: boolean;
  problemId: string | null;
  codeSubmission: string | null;
  codeLanguage: string | null;
  createdAt: Date;
}

export interface StartRoundRequest {
  sessionId: string;
  roundId: string;
}

export interface CompleteRoundRequest {
  sessionId: string;
  roundId: string;
  interviewId?: string;
}

export interface SubmitCodeRequest {
  roundId: string;
  code: string;
  language: string;
}

export interface CodingProblemResponse {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: string;
  starterCode: Record<string, string> | null;
  hints: string[];
}

export interface CodeEvaluationResult {
  passed: boolean;
  testResults: TestResult[];
  feedback: string;
  score: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

// Round display info for frontend
export interface RoundDisplayInfo {
  type: RoundType;
  title: string;
  description: string;
  icon: string;
  estimatedDuration: number;
}

export const ROUND_DISPLAY_INFO: Record<RoundType, Omit<RoundDisplayInfo, 'type'>> = {
  [RoundType.BEHAVIORAL]: {
    title: 'Behavioral Round',
    description: 'Questions about your experience, soft skills, and culture fit',
    icon: 'users',
    estimatedDuration: 15,
  },
  [RoundType.TECHNICAL]: {
    title: 'Technical Round',
    description: 'Deep dive into your technical knowledge and problem-solving approach',
    icon: 'cpu',
    estimatedDuration: 25,
  },
  [RoundType.CODING]: {
    title: 'Live Coding',
    description: 'Solve a coding problem while explaining your thought process',
    icon: 'code',
    estimatedDuration: 30,
  },
  [RoundType.SYSTEM_DESIGN]: {
    title: 'System Design',
    description: 'Design a scalable system architecture',
    icon: 'network',
    estimatedDuration: 35,
  },
  [RoundType.HR]: {
    title: 'HR Round',
    description: 'Final discussion about role expectations and company fit',
    icon: 'briefcase',
    estimatedDuration: 10,
  },
};
