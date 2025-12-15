import { Request, Response, NextFunction } from 'express';
import * as vapiService from '../services/vapi.service';
import {
  VapiToolCallRequest,
  VapiToolCallResponse,
  GetQuestionsArgs,
  SaveCallMetadataRequest,
} from '../types/vapi.types';
import '../types/auth.types';

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

export const getUserContext = async (
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

    const result = await vapiService.getUserContext(userId);
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

export const getUserContextForUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const targetId = req.query.targetId as string | undefined;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await vapiService.getUserContext(userId, targetId);

    if (result.error) {
      res.status(400).json({ success: false, error: result.error, data: null });
      return;
    }

    res.json({
      success: true,
      data: {
        systemPrompt: result.systemPrompt,
        firstMessage: result.firstMessage,
        profile: result.data?.profile || null,
        resume: result.data?.resume || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const evaluateAnswer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const args = body.message?.toolCallList?.[0]?.arguments as any;
    
    const result = await vapiService.evaluateAnswer(args?.question || '', args?.answer || '');
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

export const provideHint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const args = body.message?.toolCallList?.[0]?.arguments as any;
    
    const result = await vapiService.provideHint(args?.question || '');
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

export const endRound = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const args = body.message?.toolCallList?.[0]?.arguments as any;
    
    // Assuming interviewId is passed in args or we can derive it. 
    // For now, using a placeholder or args.interviewId
    const result = await vapiService.endRound(args?.interviewId || 'unknown', args?.roundType || 'general');
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

export const generateReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as VapiToolCallRequest;
    const toolCallId = body.message?.toolCallList?.[0]?.id || '';
    const args = body.message?.toolCallList?.[0]?.arguments as any;
    
    const result = await vapiService.generateReport(args?.interviewId || 'unknown');
    res.json(buildResponse(toolCallId, result));
  } catch (error) {
    next(error);
  }
};

export const saveCallMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = req.body as SaveCallMetadataRequest;
    if (!body.interviewId || !body.callId) {
      res.status(400).json({ success: false, message: 'interviewId and callId are required' });
      return;
    }

    const result = await vapiService.saveCallMetadata(userId, body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};


