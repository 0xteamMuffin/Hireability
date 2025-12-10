import { Request, Response, NextFunction } from 'express';
import * as interviewService from '../services/interview.service';
import { StartInterviewRequest, SaveAnalysisRequest } from '../types/interview.types';

export const startInterview = async (
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

    const body = req.body as StartInterviewRequest;
    const created = await interviewService.createInterview(userId, body);
    res.json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const saveAnalysis = async (
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

    const body = req.body as SaveAnalysisRequest;
    if (!body.interviewId) {
      res.status(400).json({ success: false, message: 'interviewId is required' });
      return;
    }

    try {
      const saved = await interviewService.saveAnalysis(userId, body);
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Failed to save analysis' });
    }
  } catch (error) {
    next(error);
  }
};

