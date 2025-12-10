import { Request, Response, NextFunction } from 'express';
import * as transcriptService from '../services/transcript.service';
import { SaveTranscriptRequest } from '../types/transcript.types';

export const saveTranscript = async (
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

    const body = req.body as SaveTranscriptRequest;

    if (!body.interviewId) {
      res.status(400).json({ success: false, message: 'interviewId is required' });
      return;
    }

    if (!body.transcript || !Array.isArray(body.transcript) || body.transcript.length === 0) {
      res.status(400).json({ success: false, message: 'Transcript is required' });
      return;
    }

    try {
      const saved = await transcriptService.saveTranscript(userId, body);
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Failed to save transcript' });
    }
  } catch (error) {
    next(error);
  }
};

