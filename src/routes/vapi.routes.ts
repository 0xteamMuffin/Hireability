import { Router } from 'express';
import * as vapiController from '../controllers/vapi.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/getUserData', vapiController.getUserData);
router.post('/getResumeData', vapiController.getResumeData);
router.post('/getQuestions', vapiController.getQuestions);
router.post('/getUserContext', vapiController.getUserContext);
router.post('/evaluateAnswer', vapiController.evaluateAnswer);
router.post('/provideHint', vapiController.provideHint);
router.post('/endRound', vapiController.endRound);
router.post('/generateReport', vapiController.generateReport);
router.get('/context', authMiddleware, vapiController.getUserContextForUser);

export default router;
