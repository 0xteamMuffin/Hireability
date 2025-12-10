import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as interviewController from '../controllers/interview.controller';

const router = Router();

router.post('/', authMiddleware, interviewController.startInterview);
router.post('/analysis', authMiddleware, interviewController.saveAnalysis);

export default router;

