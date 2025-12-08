import { Request, Response, NextFunction } from 'express';
import * as vapiService from '../services/vapi.service';
import {
  VapiToolCallRequest,
  VapiToolCallResponse,
  GetQuestionsArgs,
} from '../types/vapi.types';

/**
 * Extracts userId from Vapi call context.
 * userId is passed via assistantOverrides.variableValues when starting the call.
 * It can also be found in artifact.variableValues during the conversation.
 */
const extractUserId = (req: Request): string | null => {
  const body = req.body as VapiToolCallRequest;
  
  // Check assistantOverrides.variableValues first (set when call starts)
  const fromOverrides = body.message?.call?.assistantOverrides?.variableValues?.userId;
  if (fromOverrides) return fromOverrides;
  
  // Check artifact.variableValues (available during conversation)
  const fromArtifact = body.message?.artifact?.variableValues?.userId;
  if (fromArtifact) return fromArtifact;
  
  return null;
};

/**
 * Builds the standard Vapi tool response format.
 */
const buildResponse = (toolCallId: string, result: unknown): VapiToolCallResponse => ({
  results: [
    {
      toolCallId,
      result: typeof result === 'string' ? result : JSON.stringify(result),
    },
  ],
});

export const getUserData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const userId = extractUserId(req);

    if (!userId) {
      res.json(buildResponse(toolCallId, { error: 'userId not found in call metadata' }));
      return;
    }

    const result = await vapiService.getUserData(userId);
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

export const getResumeData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const userId = extractUserId(req);

    if (!userId) {
      res.json(buildResponse(toolCallId, { error: 'userId not found in call metadata' }));
      return;
    }

    const result = await vapiService.getResumeData(userId);
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

export const getQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const userId = extractUserId(req);
    const args = (body.message?.toolCallList?.[0]?.arguments || {}) as GetQuestionsArgs;

    if (!userId) {
      res.json(buildResponse(toolCallId, { error: 'userId not found in call metadata' }));
      return;
    }

    const result = await vapiService.getQuestions(userId, args);
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};
