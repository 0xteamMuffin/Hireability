import { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service';
import { UpdateUserInput, UpdatePasswordInput, UpdateSettingsInput } from '../types/settings.types';
import '../types/auth.types';

export const getUserDetails = async (
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

    const user = await settingsService.getUserDetails(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUserDetails = async (
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

    const data = req.body as UpdateUserInput;
    const user = await settingsService.updateUserDetails(userId, data);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (
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

    const { currentPassword, newPassword } = req.body as UpdatePasswordInput;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current and new password are required',
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
      return;
    }

    await settingsService.updatePassword(userId, { currentPassword, newPassword });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Current password is incorrect') {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const getSettings = async (
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

    const settings = await settingsService.getSettings(userId);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
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

    const data = req.body as UpdateSettingsInput;
    const settings = await settingsService.upsertSettings(userId, data);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (
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

    await settingsService.deleteAccount(userId);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};
