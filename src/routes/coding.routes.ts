/**
 * Coding Routes
 * Coding problems and evaluation endpoints
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as codingController from '../controllers/coding.controller';

const router = Router();

// Public routes (for browsing problems)
router.get('/problems', codingController.getAllProblems);
router.get('/problems/random', codingController.getProblem);
router.get('/problems/:problemId', codingController.getProblemById);

// Authenticated routes
router.use(authMiddleware);

// Code execution and submission
router.post('/run', codingController.runCode);
router.post('/submit', codingController.submitCode);
router.post('/hint', codingController.getHint);

// Round-specific
router.post('/round/:roundId/assign', codingController.assignProblem);

// Admin/seeding
router.post('/seed', codingController.seedProblems);

export default router;
