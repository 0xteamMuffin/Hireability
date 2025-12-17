/**
 * Session Controller
 * Handles multi-round interview session management
 */

import { Request, Response, NextFunction } from 'express';
import * as sessionService from '../services/session.service';
import {
  CreateSessionRequest,
  StartRoundRequest,
  CompleteRoundRequest,
} from '../types/round.types';

export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = req.body as CreateSessionRequest;
    const session = await sessionService.createSession(userId, body);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const getSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const sessions = await sessionService.getSessions(userId);
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};

export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { sessionId } = req.params;
    const session = await sessionService.getSession(userId, sessionId);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const getActiveSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const session = await sessionService.getActiveSession(userId);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const startRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = req.body as StartRoundRequest;
    const round = await sessionService.startRound(userId, body);
    res.json({ success: true, data: round });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const completeRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const body = req.body as CompleteRoundRequest;
    const session = await sessionService.completeRound(userId, body);
    res.json({ success: true, data: session });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const skipRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { sessionId, roundId } = req.params;
    const session = await sessionService.skipRound(userId, sessionId, roundId);
    res.json({ success: true, data: session });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const abandonSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { sessionId } = req.params;
    const session = await sessionService.abandonSession(userId, sessionId);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

export const checkMultiRoundEnabled = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const enabled = await sessionService.isMultiRoundEnabled(userId);
    res.json({ success: true, data: { multiRoundEnabled: enabled } });
  } catch (error) {
    next(error);
  }
};

export const deleteSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { sessionId } = req.params;
    await sessionService.deleteSession(userId, sessionId);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    next(error);
  }
};
