/**
 * Coding Controller
 * Handles coding problems and code evaluation
 */

import { Request, Response, NextFunction } from 'express';
import * as codingService from '../services/coding.service';
import * as pistonService from '../services/piston.service';
import { Difficulty, SubmitCodeRequest } from '../types/round.types';

export const getProblem = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { difficulty, category } = req.query;

    const problem = await codingService.getProblem(
      difficulty as Difficulty | undefined,
      category as string | undefined,
    );

    if (!problem) {
      res.status(404).json({ success: false, message: 'No problem found' });
      return;
    }

    res.json({ success: true, data: problem });
  } catch (error) {
    next(error);
  }
};

export const getProblemById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { problemId } = req.params;

    const problem = await codingService.getProblemById(problemId);

    if (!problem) {
      res.status(404).json({ success: false, message: 'Problem not found' });
      return;
    }

    res.json({ success: true, data: problem });
  } catch (error) {
    next(error);
  }
};

export const getAllProblems = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { difficulty, category } = req.query;

    const problems = await codingService.getAllProblems(
      difficulty as Difficulty | undefined,
      category as string | undefined,
    );

    res.json({ success: true, data: problems });
  } catch (error) {
    next(error);
  }
};

export const assignProblem = async (
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

    const { roundId } = req.params;
    const { problemId, difficulty } = req.body;

    const problem = await codingService.assignProblemToRound(
      roundId,
      problemId,
      difficulty as Difficulty | undefined,
    );

    res.json({ success: true, data: problem });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const submitCode = async (
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

    const body = req.body as SubmitCodeRequest;

    if (!body.roundId || !body.code || !body.language) {
      res.status(400).json({
        success: false,
        message: 'roundId, code, and language are required',
      });
      return;
    }

    const result = await codingService.submitCode(userId, body);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const getHint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { code, language, problemDescription } = req.body;

    if (!code || !language || !problemDescription) {
      res.status(400).json({
        success: false,
        message: 'code, language, and problemDescription are required',
      });
      return;
    }

    const hint = await codingService.getCodeHint(code, language, problemDescription);
    res.json({ success: true, data: { hint } });
  } catch (error) {
    next(error);
  }
};

export const seedProblems = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await codingService.seedProblems();
    res.json({ success: true, message: 'Problems seeded successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Run code without evaluation (just execution)
 */
export const runCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { code, language, stdin } = req.body;

    if (!code || !language) {
      res.status(400).json({
        success: false,
        message: 'code and language are required',
      });
      return;
    }

    const result = await pistonService.executeCode(code, language, stdin);

    res.json({
      success: true,
      data: {
        success: result.success,
        output: result.output,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
      },
    });
  } catch (error) {
    next(error);
  }
};
