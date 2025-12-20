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
  args: InitializeInterviewArgs,
): Promise<{ success: boolean; state: InterviewStateSnapshot | null; error?: string }> => {
  try {
    const [profile, document] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: args.userId } }),
      db.document.findFirst({
        where: { userId: args.userId, type: 'RESUME', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

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

    let resumeContext: string | undefined;
    if (document?.parsedData) {
      const parsed = document.parsedData as Record<string, unknown>;
      resumeContext = JSON.stringify({
        skills: parsed.skills,
        experience: parsed.experience,
        education: parsed.education,
      }).slice(0, 2000);
    }

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

    interviewStateService.setPhase(args.interviewId, InterviewPhase.INTRODUCTION);

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

export interface GetNextQuestionArgs {
  interviewId: string;
  previousAnswer?: string;
}

/**
 * Get the next adaptive question based on interview state
 * Called by VAPI tool: getNextQuestion
 */
export const getNextQuestion = async (
  args: GetNextQuestionArgs,
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

  if (state.phase === InterviewPhase.INTRODUCTION && state.performance.totalQuestions > 0) {
    interviewStateService.setPhase(args.interviewId, InterviewPhase.MAIN_QUESTIONS);
  }

  const nextQuestion = await adaptiveQuestionGenerator.generateNextQuestion(state);

  interviewStateService.recordQuestion(args.interviewId, {
    question: nextQuestion.question,
    category: nextQuestion.category,
    difficulty: nextQuestion.difficulty,
    isFollowUp: nextQuestion.isFollowUp,
  });

  emitStateUpdate(args.interviewId);

  return nextQuestion;
};

export interface EvaluateAnswerArgs {
  interviewId: string;
  questionId?: string;
  answer: string;
}

/**
 * Evaluate a candidate's answer in real-time
 * Called by VAPI tool: evaluateAnswer
 */
export const evaluateAnswer = async (
  args: EvaluateAnswerArgs,
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

  interviewStateService.recordAnswer(args.interviewId, {
    questionId: question.id,
    answer: args.answer,
    score: evaluation.score,
    feedback: evaluation.feedback,
    suggestFollowUp: evaluation.suggestFollowUp,
  });

  emitStateUpdate(args.interviewId);

  return evaluation;
};

/**
 * Get current interview state snapshot
 * Called by VAPI tool: getInterviewState
 */
export const getInterviewStateSnapshot = (interviewId: string): InterviewStateSnapshot | null => {
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

export interface PresentCodingProblemArgs {
  interviewId: string;
  problemId?: string;
  difficulty?: Difficulty;
  language?: string;
}

/**
 * Present a coding problem to the candidate
 * Called by VAPI tool: presentCodingProblem
 */
export const presentCodingProblem = async (
  args: PresentCodingProblemArgs,
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

  let problem;
  console.log(
    '[presentCodingProblem] Looking for problem, difficulty:',
    args.difficulty || state.performance.suggestedDifficulty,
  );

  if (args.problemId) {
    problem = await db.codingProblem.findUnique({ where: { id: args.problemId } });
  } else {
    const difficulty = args.difficulty || state.performance.suggestedDifficulty;
    problem = await db.codingProblem.findFirst({
      where: { difficulty },
      orderBy: { createdAt: 'desc' },
    });

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

  const language = args.language || 'javascript';
  const starterCodeJson = problem.starterCode as Record<string, string> | null;
  const starterCode = starterCodeJson?.[language] || starterCodeJson?.['javascript'] || '';

  const codingState = interviewStateService.initializeCodingState(
    args.interviewId,
    {
      id: problem.id,
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      starterCode,
      hints: problem.hints || [],
      testCases: Array.isArray(problem.testCases) ? problem.testCases.length : 0,
    },
    language,
  );

  if (state.sessionId) {
    try {
      await db.interviewRound.updateMany({
        where: {
          sessionId: state.sessionId,
          roundType: state.roundType,
          status: { not: 'COMPLETED' },
        },
        data: {
          problemId: problem.id,
          interviewId: args.interviewId,
          status: 'IN_PROGRESS',
        },
      });
      console.log('[presentCodingProblem] Updated interview round with problem:', problem.id);
    } catch (err) {
      console.error('[presentCodingProblem] Failed to update interview round:', err);
    }
  }

  interviewStateService.setPhase(args.interviewId, InterviewPhase.CODING_SETUP);

  const speechDescription = generateProblemSpeech(problem);

  emitCodingProblemAssigned(args.interviewId, codingState!);
  socketService.emitStateUpdate(args.interviewId);

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
  interviewId: string,
): Promise<{
  hasCode: boolean;
  linesOfCode: number;
  codeLength: number;
  language: string;
  lastActivity: string;
  hintsUsed: number;
  hintsAvailable: number;
  attempts: number;
  isTyping: boolean;
  feedback: string;
}> => {
  const state = interviewStateService.getInterviewState(interviewId);

  if (!state || !state.codingState) {
    return {
      hasCode: false,
      linesOfCode: 0,
      codeLength: 0,
      language: 'unknown',
      lastActivity: 'unknown',
      hintsUsed: 0,
      hintsAvailable: 0,
      attempts: 0,
      isTyping: false,
      feedback: 'No coding session active.',
    };
  }

  const coding = state.codingState;
  const lines = coding.currentCode.split('\n').filter((l) => l.trim()).length;
  const timeSinceStart = Math.floor((Date.now() - coding.startedAt.getTime()) / 1000);
  const isTyping = state.candidateSignals?.isTyping || false;
  const lastCodeUpdate = state.candidateSignals?.lastCodeUpdate;
  const secondsSinceLastUpdate = lastCodeUpdate
    ? Math.floor((Date.now() - new Date(lastCodeUpdate).getTime()) / 1000)
    : timeSinceStart;

  let feedback = '';
  if (isTyping || secondsSinceLastUpdate < 10) {
    feedback = 'The candidate is actively typing code.';
  } else if (lines < 5 && timeSinceStart > 120) {
    feedback =
      "The candidate hasn't written much code yet. Consider asking if they want to talk through their approach.";
  } else if (lines > 20) {
    feedback = 'The candidate has written substantial code. They may be close to a solution.';
  } else if (lines > 10) {
    feedback = 'The candidate is making progress on the code.';
  } else if (coding.submissions.length > 0) {
    const lastSubmission = coding.submissions[coding.submissions.length - 1];
    const passed = lastSubmission.result.testResults?.filter((t) => t.passed).length || 0;
    const total = lastSubmission.result.testResults?.length || 0;
    feedback = `Last submission: ${passed}/${total} tests passed.`;
  } else {
    feedback = 'The candidate is working on the problem.';
  }

  return {
    hasCode: lines > 0,
    linesOfCode: lines,
    codeLength: coding.currentCode.length,
    language: coding.language,
    lastActivity:
      secondsSinceLastUpdate < 60
        ? `${secondsSinceLastUpdate} seconds ago`
        : `${Math.floor(secondsSinceLastUpdate / 60)} minutes ago`,
    hintsUsed: coding.hintsUsed,
    hintsAvailable: coding.hintsAvailable?.length || 0,
    attempts: coding.submissions.length,
    isTyping,
    feedback,
  };
};

export interface ExecuteCodeArgs {
  interviewId: string;
  code?: string;
  language?: string;
}

/**
 * Execute candidate's code against test cases
 * Called by VAPI tool: executeCode
 */
export const executeCode = async (
  args: ExecuteCodeArgs,
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

  const codeToExecute = args.code || state.codingState.currentCode;
  const language = args.language || state.codingState.language;

  console.log(
    `[executeCode] Running code for ${args.interviewId}, language: ${language}, code length: ${codeToExecute.length}`,
  );

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

  const result = await pistonService.executeWithTestCases(
    codeToExecute,
    language,
    problem.testCases as pistonService.TestCase[],
  );

  interviewStateService.recordCodeSubmission(args.interviewId, codeToExecute, language, result);

  interviewStateService.updateCodingState(args.interviewId, {
    code: codeToExecute,
    language: language,
    executionResult: result,
  });

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

  emitCodeExecuted(args.interviewId, result);

  return { result, feedback, allPassed };
};

/**
 * Provide a hint for the coding problem
 * Called by VAPI tool: getCodingHint
 */
export const getCodingHint = async (
  interviewId: string,
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

  interviewStateService.updateCodingState(interviewId, { hintUsed: true });

  emitHintProvided(interviewId, hint, hintsAvailable.length - hintsUsed - 1);

  return {
    hint,
    hintsRemaining: hintsAvailable.length - hintsUsed - 1,
  };
};

/**
 * Complete the interview and generate summary
 * Called by VAPI tool: completeInterview
 */
export const completeInterview = async (
  interviewId: string,
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

  const avgScore = state.performance.averageScore;
  let farewell: string;

  if (avgScore >= 8) {
    farewell =
      'Excellent interview! You demonstrated strong skills across the board. Thank you for your time, and best of luck!';
  } else if (avgScore >= 6) {
    farewell =
      'Good interview! You showed solid understanding of the topics we covered. Thank you for your time today.';
  } else {
    farewell =
      'Thank you for taking the time to interview with us today. Best of luck in your job search!';
  }

  emitInterviewCompleted(interviewId, snapshot!);

  return {
    completed: true,
    summary: snapshot,
    farewell,
  };
};

const generateProblemSpeech = (problem: any): string => {
  const difficultyWord =
    problem.difficulty === 'EASY'
      ? 'straightforward'
      : problem.difficulty === 'HARD'
        ? 'challenging'
        : 'moderate';

  return `Here's your coding problem. It's a ${difficultyWord} one called "${problem.title}". ${problem.description.slice(0, 500)}. The problem is now displayed in your code editor. Take your time to understand it, and feel free to ask clarifying questions or think out loud as you work through it.`;
};

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

export interface GenerateCodingQuestionArgs {
  interviewId: string;
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Generate a coding question based on interview transcript using Gemini
 */
export const generateCodingQuestion = async (
  args: GenerateCodingQuestionArgs,
): Promise<{ question: string }> => {
  const state = interviewStateService.getInterviewState(args.interviewId);

  if (!state) {
    throw new Error('Interview state not found');
  }

  const conversationHistory = args.transcript
    .map((entry) => `${entry.role === 'user' ? 'Candidate' : 'Interviewer'}: ${entry.content}`)
    .join('\n\n');

  const prompt = `
You are a technical interviewer conducting a ${state.roundType} interview for a ${state.targetRole || 'Software Engineer'} position at ${state.targetCompany || 'a tech company'}.

**Interview Context:**
- Role: ${state.targetRole || 'Software Engineer'}
- Company: ${state.targetCompany || 'Unknown'}
- Experience Level: ${state.experienceLevel || 'mid-level'}
- Round Type: ${state.roundType}

**Previous Conversation:**
${conversationHistory}

Based on the conversation so far, generate an appropriate coding question that:
1. Is relevant to the role and experience level
2. Builds on topics discussed in the conversation
3. Is challenging but fair for the candidate's level
4. Can be solved in 30-45 minutes
5. Tests problem-solving, algorithms, and coding skills

Provide a clear, well-structured coding problem with:
- Problem statement
- Input/output format
- Example test cases
- Constraints (if applicable)

Respond with ONLY the coding question text, no additional commentary or markdown formatting.
`;

  try {
    const genaiModule = await import('../utils/gemini.util');
    const genai = genaiModule.default;
    const { geminiConfig } = genaiModule;
    
    const response = await genai.models.generateContent({
      model: process.env.MODEL_NAME || 'gemini-flash-latest',
      config: {
        ...geminiConfig,
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const question = (response.text || '').trim();

    if (!question) {
      throw new Error('Failed to generate coding question');
    }

    return { question };
  } catch (error) {
    console.error('[generateCodingQuestion] Error:', error);
    throw new Error('Failed to generate coding question');
  }
};

export interface EvaluateCodingSolutionArgs {
  interviewId: string;
  question: string;
  solution: string;
  language?: string;
}

/**
 * Evaluate a coding solution using Gemini
 */
export const evaluateCodingSolution = async (
  args: EvaluateCodingSolutionArgs,
): Promise<{
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  passed: boolean;
}> => {
  const state = interviewStateService.getInterviewState(args.interviewId);

  if (!state) {
    return {
      score: 0,
      feedback: 'Interview state not found',
      strengths: [],
      improvements: [],
      passed: false,
    };
  }

  const prompt = `
You are evaluating a candidate's coding solution during a technical interview.

**Question:**
${args.question}

**Candidate's Solution (${args.language || 'unknown'}):**
\`\`\`${args.language || 'text'}
${args.solution}
\`\`\`

**Context:**
- Role: ${state.targetRole || 'Software Engineer'}
- Company: ${state.targetCompany || 'Unknown'}
- Experience Level: ${state.experienceLevel || 'mid-level'}
- Round Type: ${state.roundType}

Evaluate the solution and provide:
1. A score from 0-10
2. Detailed feedback
3. Strengths (array of strings)
4. Areas for improvement (array of strings)
5. Whether the solution passed (boolean)

Consider:
- Correctness and logic
- Code quality and readability
- Efficiency (time/space complexity)
- Edge case handling
- Best practices

Respond with a JSON object:
{
  "score": number,
  "feedback": string,
  "strengths": string[],
  "improvements": string[],
  "passed": boolean
}
`;

  try {
    const genaiModule = await import('../utils/gemini.util');
    const genai = genaiModule.default;
    const { geminiConfig } = genaiModule;
    const response = await genai.models.generateContent({
      model: process.env.MODEL_NAME || 'gemini-flash-latest',
      config: {
        ...geminiConfig,
        responseMimeType: 'application/json',
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const content = response.text || '{}';
    const parsed = JSON.parse(content);

    return {
      score: Math.max(0, Math.min(10, parsed.score || 0)),
      feedback: parsed.feedback || 'No feedback provided',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      passed: parsed.passed ?? false,
    };
  } catch (error) {
    console.error('[evaluateCodingSolution] Error:', error);
    return {
      score: 5,
      feedback: 'An error occurred during evaluation',
      strengths: [],
      improvements: [],
      passed: false,
    };
  }
};

export interface ResumeCallArgs {
  interviewId: string;
  previousSystemPrompt: string;
  previousConversation: Array<{ role: 'user' | 'assistant'; content: string }>;
  evaluation: {
    question: string;
    solution: string;
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    passed: boolean;
  };
}

/**
 * Build context for resuming a VAPI call after coding question
 */
export const buildResumeCallContext = async (
  args: ResumeCallArgs,
): Promise<{ systemPrompt: string; firstMessage: string }> => {
  const state = interviewStateService.getInterviewState(args.interviewId);

  if (!state) {
    throw new Error('Interview state not found');
  }

  const evaluationSummary = `
**Coding Question Evaluation:**

Question: ${args.evaluation.question}

Candidate's Solution:
\`\`\`
${args.evaluation.solution}
\`\`\`

Score: ${args.evaluation.score}/10
Passed: ${args.evaluation.passed ? 'Yes' : 'No'}

Feedback: ${args.evaluation.feedback}

Strengths:
${args.evaluation.strengths.map((s) => `- ${s}`).join('\n')}

Areas for Improvement:
${args.evaluation.improvements.map((i) => `- ${i}`).join('\n')}
`;

  const conversationHistory = args.previousConversation
    .map((entry) => `${entry.role === 'user' ? 'Candidate' : 'Interviewer'}: ${entry.content}`)
    .join('\n\n');

  const systemPrompt = `${args.previousSystemPrompt}

## CONTINUATION CONTEXT

You are continuing an interview that was paused for a coding question. This is NOT a new interview - you are resuming the same conversation. Act naturally as if the conversation never stopped.

**Previous Conversation History:**
${conversationHistory}

**Coding Question Session:**
${evaluationSummary}

**IMPORTANT INSTRUCTIONS FOR CONTINUATION:**
1. You just finished reviewing their coding solution - acknowledge this naturally as if you just reviewed it
2. Reference the coding question they just solved in your conversation (e.g., "That solution you wrote for the [problem type] was interesting...")
3. Build on the topics discussed before the coding question
4. Continue the technical discussion as if the coding question was a natural part of the interview flow
5. Don't act like this is a new call - reference previous conversation points naturally
6. Make it feel seamless - as if you just paused briefly to review their code and are now continuing

Continue the interview naturally. Briefly acknowledge their coding solution (mention the score and one key point from feedback), then seamlessly continue with the technical discussion. Reference previous topics naturally. Make it feel like a continuous conversation, not a restart.
`;

  const firstMessage = `Great work on that coding problem! ${args.evaluation.passed ? 'Your solution looks solid.' : 'I can see you put effort into it.'} ${args.evaluation.feedback.split('.')[0] || 'Let\'s continue our technical discussion.'}`;

  return { systemPrompt, firstMessage };
};
