/**
 * Interactive VAPI Service
 * Real-time adaptive interview tools for VAPI voice assistant
 */

import { prisma } from '../utils/prisma.util';
import * as interviewStateService from './interview-state.service';
import * as pistonService from './piston.service';
import * as socketService from './socket.service';
import { adaptiveQuestionGenerator } from '../agents/generators/adaptive-question.generator';
import { answerEvaluator } from '../agents/generators/answer-evaluator.generator';
import {
  QuestionCategory,
  Difficulty,
  RoundType,
  InterviewPhase,
  NextQuestionResponse,
  AnswerEvaluationResponse,
  InterviewStateSnapshot,
  CodeExecutionResult,
  CodingState,
} from '../types/interview-state.types';

const db = prisma as any;

// ============================================================================
// INTERVIEW INITIALIZATION
// ============================================================================

export interface InitializeInterviewArgs {
  userId: string;
  interviewId: string;
  sessionId?: string;
  roundType: RoundType;
  targetId?: string;
}

/**
 * Initialize interview state when a VAPI call starts
 * Called by VAPI tool: initializeInterview
 */
export const initializeInterview = async (
  args: InitializeInterviewArgs
): Promise<{ success: boolean; state: InterviewStateSnapshot | null; error?: string }> => {
  try {
    // Fetch user profile and resume context
    const [profile, document] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: args.userId } }),
      db.document.findFirst({
        where: { userId: args.userId, type: 'RESUME', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Get target company info if provided
    let targetRole = profile?.targetRole;
    let targetCompany = profile?.targetCompany;
    
    if (args.targetId) {
      const target = await db.targetCompany.findFirst({
        where: { id: args.targetId, userId: args.userId },
      });
      if (target) {
        targetRole = target.role;
        targetCompany = target.companyName;
      }
    }

    // Condense resume context for state
    let resumeContext: string | undefined;
    if (document?.parsedData) {
      const parsed = document.parsedData as Record<string, unknown>;
      resumeContext = JSON.stringify({
        skills: parsed.skills,
        experience: parsed.experience,
        education: parsed.education,
      }).slice(0, 2000); // Limit size
    }

    // Create interview state
    await interviewStateService.createInterviewState({
      interviewId: args.interviewId,
      userId: args.userId,
      sessionId: args.sessionId,
      roundType: args.roundType,
      targetRole,
      targetCompany,
      experienceLevel: profile?.level,
      resumeContext,
    });

    // Set initial phase
    interviewStateService.setPhase(args.interviewId, InterviewPhase.INTRODUCTION);

    // Emit state update via WebSocket so frontend receives it
    console.log('[InteractiveVapi] Emitting state update for interview:', args.interviewId);
    emitStateUpdate(args.interviewId);

    const snapshot = interviewStateService.getStateSnapshot(args.interviewId);
    console.log('[InteractiveVapi] State snapshot:', snapshot?.phase);

    return {
      success: true,
      state: snapshot,
    };
  } catch (error) {
    console.error('[InteractiveVapi] initializeInterview failed:', error);
    return {
      success: false,
      state: null,
      error: error instanceof Error ? error.message : 'Failed to initialize interview',
    };
  }
};

// ============================================================================
// ADAPTIVE QUESTIONING
// ============================================================================

export interface GetNextQuestionArgs {
  interviewId: string;
  previousAnswer?: string; // If provided, evaluate before generating next
}

/**
 * Get the next adaptive question based on interview state
 * Called by VAPI tool: getNextQuestion
 */
export const getNextQuestion = async (
  args: GetNextQuestionArgs
): Promise<NextQuestionResponse & { error?: string }> => {
  const state = interviewStateService.getInterviewState(args.interviewId);
  
  if (!state) {
    return {
      question: 'Can you tell me about your background?',
      category: QuestionCategory.INTRODUCTION,
      difficulty: Difficulty.MEDIUM,
      isFollowUp: false,
      topicsRemaining: [],
      estimatedQuestionsLeft: 5,
      error: 'Interview state not found',
    };
  }

  // Update phase if needed
  if (state.phase === InterviewPhase.INTRODUCTION && state.performance.totalQuestions > 0) {
    interviewStateService.setPhase(args.interviewId, InterviewPhase.MAIN_QUESTIONS);
  }

  // Generate next question
  const nextQuestion = await adaptiveQuestionGenerator.generateNextQuestion(state);

  // Record the question in state
  interviewStateService.recordQuestion(args.interviewId, {
    question: nextQuestion.question,
    category: nextQuestion.category,
    difficulty: nextQuestion.difficulty,
    isFollowUp: nextQuestion.isFollowUp,
  });

  // Emit via socket if available
  emitStateUpdate(args.interviewId);

  return nextQuestion;
};

// ============================================================================
// ANSWER EVALUATION
// ============================================================================

export interface EvaluateAnswerArgs {
  interviewId: string;
  questionId?: string; // Optional - uses current question if not provided
  answer: string;
}

/**
 * Evaluate a candidate's answer in real-time
 * Called by VAPI tool: evaluateAnswer
 */
export const evaluateAnswer = async (
  args: EvaluateAnswerArgs
): Promise<AnswerEvaluationResponse & { error?: string }> => {
  const state = interviewStateService.getInterviewState(args.interviewId);
  
  if (!state) {
    return {
      score: 5,
      feedback: 'Thank you for your answer.',
      strengths: [],
      improvements: [],
      suggestFollowUp: false,
      topicMastery: 'intermediate',
      error: 'Interview state not found',
    };
  }

  // Find the question being answered
  const questionId = args.questionId || state.questions[state.currentQuestionIndex]?.id;
  const question = state.questions.find((q) => q.id === questionId);

  if (!question) {
    return {
      score: 5,
      feedback: 'Thank you for your answer.',
      strengths: [],
      improvements: [],
      suggestFollowUp: false,
      topicMastery: 'intermediate',
      error: 'Question not found',
    };
  }

  // Evaluate the answer
  const evaluation = await answerEvaluator.evaluate({
    question: question.question,
    category: question.category,
    difficulty: question.difficulty,
    answer: args.answer,
    targetRole: state.targetRole,
    targetCompany: state.targetCompany,
    experienceLevel: state.experienceLevel,
    roundType: state.roundType,
    questionsAsked: state.performance.totalQuestions,
    averageScore: state.performance.averageScore,
  });

  // Record the answer in state
  interviewStateService.recordAnswer(args.interviewId, {
    questionId: question.id,
    answer: args.answer,
    score: evaluation.score,
    feedback: evaluation.feedback,
    suggestFollowUp: evaluation.suggestFollowUp,
  });

  // Emit via socket
  emitStateUpdate(args.interviewId);

  return evaluation;
};

// ============================================================================
// INTERVIEW STATE QUERIES
// ============================================================================

/**
 * Get current interview state snapshot
 * Called by VAPI tool: getInterviewState
 */
export const getInterviewStateSnapshot = (
  interviewId: string
): InterviewStateSnapshot | null => {
  return interviewStateService.getStateSnapshot(interviewId);
};

/**
 * Check if interview should wrap up
 * Called by VAPI tool: shouldWrapUp
 */
export const shouldWrapUp = (interviewId: string): { shouldWrapUp: boolean; reason: string } => {
  const state = interviewStateService.getInterviewState(interviewId);
  
  if (!state) {
    return { shouldWrapUp: true, reason: 'Interview state not found' };
  }

  interviewStateService.updateElapsedTime(interviewId);

  if (state.shouldWrapUp) {
    const elapsedMinutes = state.elapsedSeconds / 60;
    if (elapsedMinutes >= state.estimatedDurationMinutes * 0.9) {
      return { shouldWrapUp: true, reason: 'Approaching time limit' };
    }
    return { shouldWrapUp: true, reason: 'Sufficient questions asked' };
  }

  return { shouldWrapUp: false, reason: '' };
};

// ============================================================================
// CODING ROUND TOOLS
// ============================================================================

export interface PresentCodingProblemArgs {
  interviewId: string;
  problemId?: string; // Optional - auto-selects if not provided
  difficulty?: Difficulty;
  language?: string;
}

/**
 * Present a coding problem to the candidate
 * Called by VAPI tool: presentCodingProblem
 */
export const presentCodingProblem = async (
  args: PresentCodingProblemArgs
): Promise<{ problem: CodingState | null; speechDescription: string; error?: string }> => {
  console.log('[presentCodingProblem] Args:', args);
  
  const state = interviewStateService.getInterviewState(args.interviewId);
  console.log('[presentCodingProblem] Interview state exists:', !!state);
  
  if (!state) {
    return {
      problem: null,
      speechDescription: 'There was an issue loading the coding problem.',
      error: 'Interview state not found',
    };
  }

  // Fetch problem from database
  let problem;
  console.log('[presentCodingProblem] Looking for problem, difficulty:', args.difficulty || state.performance.suggestedDifficulty);
  
  if (args.problemId) {
    problem = await db.codingProblem.findUnique({ where: { id: args.problemId } });
  } else {
    // Auto-select based on difficulty
    const difficulty = args.difficulty || state.performance.suggestedDifficulty;
    problem = await db.codingProblem.findFirst({
      where: { difficulty },
      orderBy: { createdAt: 'desc' },
    });
    
    // Fallback: try to get any problem if none found for specific difficulty
    if (!problem) {
      console.log('[presentCodingProblem] No problem for difficulty, trying fallback...');
      problem = await db.codingProblem.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  console.log('[presentCodingProblem] Problem found:', !!problem, problem?.title);

  if (!problem) {
    return {
      problem: null,
      speechDescription: 'No coding problem available at the moment.',
      error: 'Problem not found',
    };
  }

  // Initialize coding state
  const language = args.language || 'javascript';
  const starterCodeJson = problem.starterCode as Record<string, string> | null;
  const starterCode = starterCodeJson?.[language] || starterCodeJson?.['javascript'] || '// Write your solution here';
  
  const codingState = interviewStateService.initializeCodingState(args.interviewId, {
    id: problem.id,
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty,
    starterCode,
    hints: problem.hints || [],
    testCases: Array.isArray(problem.testCases) ? problem.testCases.length : 0,
  }, language);

  // Update phase
  interviewStateService.setPhase(args.interviewId, InterviewPhase.CODING_SETUP);

  // Generate speech-friendly description
  const speechDescription = generateProblemSpeech(problem);

  // Emit via socket
  emitCodingProblemAssigned(args.interviewId, codingState!);

  return {
    problem: codingState,
    speechDescription,
  };
};

/**
 * Check candidate's code progress during coding round
 * Called by VAPI tool: checkCodeProgress
 */
export const checkCodeProgress = async (
  interviewId: string
): Promise<{
  hasCode: boolean;
  linesOfCode: number;
  lastActivity: string;
  feedback: string;
}> => {
  const state = interviewStateService.getInterviewState(interviewId);
  
  if (!state || !state.codingState) {
    return {
      hasCode: false,
      linesOfCode: 0,
      lastActivity: 'unknown',
      feedback: 'No coding session active.',
    };
  }

  const coding = state.codingState;
  const lines = coding.currentCode.split('\n').filter((l) => l.trim()).length;
  const timeSinceStart = Math.floor((Date.now() - coding.startedAt.getTime()) / 1000);

  let feedback = '';
  if (lines < 5 && timeSinceStart > 120) {
    feedback = 'I notice you haven\'t written much code yet. Would you like to talk through your approach first?';
  } else if (lines > 10) {
    feedback = 'Looks like you\'re making progress. Let me know when you\'re ready to run the tests.';
  } else {
    feedback = 'Take your time. Feel free to think out loud as you work through the problem.';
  }

  return {
    hasCode: lines > 0,
    linesOfCode: lines,
    lastActivity: `${timeSinceStart} seconds ago`,
    feedback,
  };
};

export interface ExecuteCodeArgs {
  interviewId: string;
  code: string;
  language: string;
}

/**
 * Execute candidate's code against test cases
 * Called by VAPI tool: executeCode
 */
export const executeCode = async (
  args: ExecuteCodeArgs
): Promise<{
  result: CodeExecutionResult;
  feedback: string;
  allPassed: boolean;
}> => {
  const state = interviewStateService.getInterviewState(args.interviewId);
  
  if (!state || !state.codingState) {
    return {
      result: { success: false, error: 'No coding session active' },
      feedback: 'There was an issue running your code.',
      allPassed: false,
    };
  }

  // Get test cases for the problem
  const problem = await db.codingProblem.findUnique({
    where: { id: state.codingState.problemId },
  });

  if (!problem || !problem.testCases) {
    return {
      result: { success: false, error: 'Test cases not found' },
      feedback: 'Unable to find test cases for this problem.',
      allPassed: false,
    };
  }

  // Execute code with Piston
  const result = await pistonService.executeWithTestCases(
    args.code,
    args.language,
    problem.testCases as pistonService.TestCase[]
  );

  // Record submission
  interviewStateService.recordCodeSubmission(
    args.interviewId,
    args.code,
    args.language,
    result
  );

  // Update coding state
  interviewStateService.updateCodingState(args.interviewId, {
    code: args.code,
    language: args.language,
    executionResult: result,
  });

  // Generate feedback
  const passed = result.testResults?.filter((t) => t.passed).length || 0;
  const total = result.testResults?.length || 0;
  const allPassed = passed === total && total > 0;

  let feedback: string;
  if (allPassed) {
    feedback = `Excellent! All ${total} test cases passed. Great job!`;
    interviewStateService.setPhase(args.interviewId, InterviewPhase.CODING_REVIEW);
  } else if (passed > 0) {
    feedback = `You passed ${passed} out of ${total} test cases. Would you like a hint, or would you like to try again?`;
  } else if (result.error) {
    feedback = `There's an error in your code: ${result.error.slice(0, 100)}. Take a look and try again.`;
  } else {
    feedback = 'None of the test cases passed yet. Would you like to talk through your approach?';
  }

  // Emit via socket
  emitCodeExecuted(args.interviewId, result);

  return { result, feedback, allPassed };
};

/**
 * Provide a hint for the coding problem
 * Called by VAPI tool: getCodingHint
 */
export const getCodingHint = async (
  interviewId: string
): Promise<{ hint: string; hintsRemaining: number }> => {
  const state = interviewStateService.getInterviewState(interviewId);
  
  if (!state || !state.codingState) {
    return {
      hint: 'No coding problem is currently active.',
      hintsRemaining: 0,
    };
  }

  const coding = state.codingState;
  const hintsAvailable = coding.hintsAvailable || [];
  const hintsUsed = coding.hintsUsed;

  if (hintsUsed >= hintsAvailable.length) {
    return {
      hint: 'No more hints available. Try to work through it, and let me know if you want to discuss your approach.',
      hintsRemaining: 0,
    };
  }

  const hint = hintsAvailable[hintsUsed];
  
  // Update state
  interviewStateService.updateCodingState(interviewId, { hintUsed: true });

  // Emit via socket
  emitHintProvided(interviewId, hint, hintsAvailable.length - hintsUsed - 1);

  return {
    hint,
    hintsRemaining: hintsAvailable.length - hintsUsed - 1,
  };
};

// ============================================================================
// INTERVIEW COMPLETION
// ============================================================================

/**
 * Complete the interview and generate summary
 * Called by VAPI tool: completeInterview
 */
export const completeInterview = async (
  interviewId: string
): Promise<{
  completed: boolean;
  summary: InterviewStateSnapshot | null;
  farewell: string;
}> => {
  const state = await interviewStateService.completeInterview(interviewId);
  
  if (!state) {
    return {
      completed: false,
      summary: null,
      farewell: 'Thank you for your time today.',
    };
  }

  const snapshot = interviewStateService.getStateSnapshot(interviewId);
  
  // Generate personalized farewell
  const avgScore = state.performance.averageScore;
  let farewell: string;
  
  if (avgScore >= 8) {
    farewell = 'Excellent interview! You demonstrated strong skills across the board. Thank you for your time, and best of luck!';
  } else if (avgScore >= 6) {
    farewell = 'Good interview! You showed solid understanding of the topics we covered. Thank you for your time today.';
  } else {
    farewell = 'Thank you for taking the time to interview with us today. Best of luck in your job search!';
  }

  // Emit via socket
  emitInterviewCompleted(interviewId, snapshot!);

  return {
    completed: true,
    summary: snapshot,
    farewell,
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateProblemSpeech = (problem: any): string => {
  const difficultyWord = problem.difficulty === 'EASY' ? 'straightforward' 
    : problem.difficulty === 'HARD' ? 'challenging' : 'moderate';
  
  return `Here's your coding problem. It's a ${difficultyWord} one called "${problem.title}". ${problem.description.slice(0, 500)}. The problem is now displayed in your code editor. Take your time to understand it, and feel free to ask clarifying questions or think out loud as you work through it.`;
};

// Socket emission helpers - use socketService
const emitStateUpdate = (interviewId: string): void => {
  socketService.emitStateUpdate(interviewId);
};

const emitCodingProblemAssigned = (interviewId: string, problem: CodingState): void => {
  socketService.emitCodingProblemAssigned(interviewId, problem);
};

const emitCodeExecuted = (interviewId: string, result: CodeExecutionResult): void => {
  socketService.emitCodeExecuted(interviewId, result);
};

const emitHintProvided = (interviewId: string, hint: string, remaining: number): void => {
  socketService.emitHintProvided(interviewId, hint, remaining);
};

const emitInterviewCompleted = (interviewId: string, summary: InterviewStateSnapshot): void => {
  socketService.emitInterviewCompleted(interviewId, summary);
};
