import { Request, Response, NextFunction } from 'express';
import * as profileService from '../services/profile.service';
import { CreateProfileInput } from '../types/profile.types';
import '../types/auth.types';

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const profile = await profileService.getProfile(userId);

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const upsertProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { targetRole, targetCompany, level } = req.body as CreateProfileInput;

    const profile = await profileService.upsertProfile(userId, {
      targetRole,
      targetCompany,
      level,
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};
