import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as interviewController from '../controllers/interview.controller';

const router = Router();

router.get('/', authMiddleware, interviewController.getInterviews);
router.get('/stats', authMiddleware, interviewController.getStats);
router.get('/:id', authMiddleware, interviewController.getInterviewById);
router.delete('/:id', authMiddleware, interviewController.deleteInterview);
router.post('/', authMiddleware, interviewController.startInterview);
router.post('/analysis', authMiddleware, interviewController.saveAnalysis);
router.post('/:id/analyze', authMiddleware, interviewController.analyzeInterview);

export default router;

