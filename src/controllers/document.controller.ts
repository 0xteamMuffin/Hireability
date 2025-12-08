import { Request, Response, NextFunction } from 'express';
import * as documentService from '../services/document.service';
import { DocumentType } from '../types/resume.types';
import '../types/auth.types';

export const uploadResume = async (
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

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const document = await documentService.uploadAndParse(
      userId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      DocumentType.RESUME
    );

    res.json({
      success: true,
      message: 'Resume uploaded and parsed',
      data: document,
    });
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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = await documentService.getResumeData(userId);

    if (!data) {
      res.status(404).json({ success: false, message: 'No resume found' });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
