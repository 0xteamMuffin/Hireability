import { Request, Response, NextFunction } from 'express';
import * as targetService from '../services/target.service';
import { CreateTargetInput, UpdateTargetInput } from '../types/target.types';
import '../types/auth.types';

export const getTargets = async (
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

    const targets = await targetService.getTargets(userId);
    res.json({ success: true, data: targets });
  } catch (error) {
    next(error);
  }
};

export const getTargetById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const target = await targetService.getTargetById(id, userId);

    if (!target) {
      res.status(404).json({ success: false, message: 'Target not found' });
      return;
    }

    res.json({ success: true, data: target });
  } catch (error) {
    next(error);
  }
};

export const createTarget = async (
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

    const { companyName, role, companyEmail, websiteLink } = req.body as CreateTargetInput;

    if (!companyName || !role) {
      res.status(400).json({ 
        success: false, 
        message: 'Company name and role are required' 
      });
      return;
    }

    const target = await targetService.createTarget(userId, {
      companyName,
      role,
      companyEmail,
      websiteLink,
    });

    res.status(201).json({ success: true, data: target });
  } catch (error) {
    next(error);
  }
};

export const updateTarget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = req.body as UpdateTargetInput;
    const target = await targetService.updateTarget(id, userId, data);

    if (!target) {
      res.status(404).json({ success: false, message: 'Target not found' });
      return;
    }

    res.json({ success: true, data: target });
  } catch (error) {
    next(error);
  }
};

export const deleteTarget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const deleted = await targetService.deleteTarget(id, userId);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Target not found' });
      return;
    }

    res.json({ success: true, message: 'Target deleted successfully' });
  } catch (error) {
    next(error);
  }
};
