/**
 * Interactive VAPI Controller
 * Handles VAPI tool calls for real-time adaptive interviews
 */

import { Request, Response, NextFunction } from 'express';
import * as interactiveVapiService from '../services/interactive-vapi.service';
import { VapiToolCallRequest, VapiToolCallResponse } from '../types/vapi.types';
import { RoundType, Difficulty } from '../types/interview-state.types';

/**
 * Extract userId from Vapi call context or direct request body
 */
const extractUserId = (req: Request): string | null => {
  const body = req.body as VapiToolCallRequest;
  return (
    body.message?.call?.assistantOverrides?.variableValues?.userId ||
    body.message?.artifact?.variableValues?.userId ||
    (body as any).userId ||
    null
  );
};

/**
 * Extract interviewId from Vapi call context or direct request body
 */
const extractInterviewId = (req: Request): string | null => {
  const body = req.body as VapiToolCallRequest;
  return (
    body.message?.call?.assistantOverrides?.variableValues?.interviewId ||
    body.message?.artifact?.variableValues?.interviewId ||
    (body.message?.toolCallList?.[0]?.arguments as any)?.interviewId ||
    (body as any).interviewId ||
    null
  );
};

/**
 * Build standard Vapi response
 */
const buildResponse = (toolCallId: string, result: unknown): VapiToolCallResponse => ({
  results: [
    {
      toolCallId,
      result: typeof result === 'string' ? result : JSON.stringify(result),
    },
  ],
});

/**
 * Get tool call ID and arguments from request
 * Handles both VAPI tool call format and direct frontend calls
 */
const getToolCallInfo = (
  req: Request,
): { toolCallId: string; args: Record<string, unknown>; isDirect: boolean } => {
  const body = req.body as VapiToolCallRequest;
  const vapiToolCallId = body.message?.toolCallList?.[0]?.id;

  if (!vapiToolCallId && !body.message) {
    return {
      toolCallId: 'direct',
      args: body as unknown as Record<string, unknown>,
      isDirect: true,
    };
  }

  return {
    toolCallId: vapiToolCallId || '',
    args: (body.message?.toolCallList?.[0]?.arguments || {}) as Record<string, unknown>,
    isDirect: false,
  };
};

/**
 * Initialize interview state when VAPI call starts or frontend directly calls
 * Tool: initializeInterview
 */
export const initializeInterview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args, isDirect } = getToolCallInfo(req);
    const userId = extractUserId(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string | undefined);

    if (!userId) {
      if (isDirect) {
        res.status(400).json({ success: false, error: 'userId is required' });
      } else {
        res.json(buildResponse(toolCallId, { error: 'userId not found in call metadata' }));
      }
      return;
    }

    if (!interviewId) {
      if (isDirect) {
        res.status(400).json({ success: false, error: 'interviewId is required' });
      } else {
        res.json(buildResponse(toolCallId, { error: 'interviewId not found in call metadata' }));
      }
      return;
    }

    const result = await interactiveVapiService.initializeInterview({
      userId,
      interviewId,
      sessionId: args.sessionId as string | undefined,
      roundType: (args.roundType as RoundType) || RoundType.BEHAVIORAL,
      targetId: args.targetId as string | undefined,
    });

    if (isDirect) {
      res.json({ success: true, data: result });
    } else {
      res.json(buildResponse(toolCallId, result));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get the next adaptive question
 * Tool: getNextQuestion
 */
export const getNextQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      return;
    }

    const result = await interactiveVapiService.getNextQuestion({
      interviewId,
      previousAnswer: args.previousAnswer as string | undefined,
    });

    res.json(
      buildResponse(toolCallId, {
        question: result.question,
        category: result.category,
        difficulty: result.difficulty,
        isFollowUp: result.isFollowUp,
        questionsRemaining: result.estimatedQuestionsLeft,
      }),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Evaluate a candidate's answer
 * Tool: evaluateAnswer
 */
export const evaluateAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      return;
    }

    if (!args.answer) {
      res.json(buildResponse(toolCallId, { error: 'answer is required' }));
      return;
    }

    const result = await interactiveVapiService.evaluateAnswer({
      interviewId,
      questionId: args.questionId as string | undefined,
      answer: args.answer as string,
    });

    res.json(
      buildResponse(toolCallId, {
        score: result.score,
        feedback: result.feedback,
        strengths: result.strengths,
        improvements: result.improvements,
        suggestFollowUp: result.suggestFollowUp,
        followUpQuestion: result.followUpQuestion,
        topicMastery: result.topicMastery,
      }),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current interview state
 * Tool: getInterviewState
 */
export const getInterviewState = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      return;
    }

    const state = interactiveVapiService.getInterviewStateSnapshot(interviewId);

    if (!state) {
      res.json(buildResponse(toolCallId, { error: 'Interview state not found' }));
      return;
    }

    res.json(buildResponse(toolCallId, state));
  } catch (error) {
    next(error);
  }
};

/**
 * Check if interview should wrap up
 * Tool: shouldWrapUp
 */
export const shouldWrapUp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { shouldWrapUp: true, reason: 'interviewId not found' }));
      return;
    }

    const result = interactiveVapiService.shouldWrapUp(interviewId);
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

/**
 * Present a coding problem
 * Tool: presentCodingProblem
 */
export const presentCodingProblem = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      return;
    }

    const result = await interactiveVapiService.presentCodingProblem({
      interviewId,
      problemId: args.problemId as string | undefined,
      difficulty: args.difficulty as Difficulty | undefined,
      language: args.language as string | undefined,
    });

    res.json(
      buildResponse(toolCallId, {
        speechDescription: result.speechDescription,
        problemTitle: result.problem?.problemTitle,
        difficulty: result.problem?.difficulty,
        totalTestCases: result.problem?.totalTestCases,
        error: result.error,
      }),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Check candidate's code progress
 * Tool: checkCodeProgress
 */
export const checkCodeProgress = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      return;
    }

    const result = await interactiveVapiService.checkCodeProgress(interviewId);
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

/**
 * Execute candidate's code
 * Tool: executeCode
 * Note: code and language are optional - if not provided, uses current code from interview state
 */
export const executeCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args, isDirect } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      if (isDirect) {
        res.status(400).json({ success: false, error: 'interviewId is required' });
      } else {
        res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      }
      return;
    }

    const result = await interactiveVapiService.executeCode({
      interviewId,
      code: args.code as string | undefined,
      language: args.language as string | undefined,
    });

    if (isDirect) {
      res.json({
        success: true,
        data: {
          result: result.result,
          feedback: result.feedback,
          allPassed: result.allPassed,
        },
      });
      return;
    }

    res.json(
      buildResponse(toolCallId, {
        feedback: result.feedback,
        allPassed: result.allPassed,
        testsPassed: result.result.testResults?.filter((t) => t.passed).length || 0,
        totalTests: result.result.testResults?.length || 0,
        error: result.result.error,
      }),
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a coding hint
 * Tool: getCodingHint
 */
export const getCodingHint = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args, isDirect } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      if (isDirect) {
        res.status(400).json({ success: false, error: 'interviewId is required' });
      } else {
        res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      }
      return;
    }

    const result = await interactiveVapiService.getCodingHint(interviewId);

    if (isDirect) {
      res.json({ success: true, data: result });
      return;
    }

    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

/**
 * Complete the interview
 * Tool: completeInterview
 */
export const completeInterview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { toolCallId, args } = getToolCallInfo(req);
    const interviewId = extractInterviewId(req) || (args.interviewId as string);

    if (!interviewId) {
      res.json(buildResponse(toolCallId, { error: 'interviewId not found' }));
      return;
    }

    const result = await interactiveVapiService.completeInterview(interviewId);

    res.json(
      buildResponse(toolCallId, {
        completed: result.completed,
        farewell: result.farewell,
        summary: result.summary,
      }),
    );
  } catch (error) {
    next(error);
  }
};
