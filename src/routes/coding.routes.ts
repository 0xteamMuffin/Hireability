/**
 * Coding Routes
 * Coding problems and evaluation endpoints
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as codingController from '../controllers/coding.controller';

const router = Router();

router.get('/problems', codingController.getAllProblems);
router.get('/problems/random', codingController.getProblem);
router.get('/problems/:problemId', codingController.getProblemById);

router.post('/seed', codingController.seedProblems);

router.use(authMiddleware);

router.post('/run', codingController.runCode);
router.post('/submit', codingController.submitCode);
router.post('/hint', codingController.getHint);

router.post('/round/:roundId/assign', codingController.assignProblem);

export default router;
