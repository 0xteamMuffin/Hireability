import { Router } from 'express';
import * as vapiController from '../controllers/vapi.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/getUserData', vapiController.getUserData);
router.post('/getResumeData', vapiController.getResumeData);
router.post('/getQuestions', vapiController.getQuestions);
router.post('/getUserContext', vapiController.getUserContext);
router.get('/context', authMiddleware, vapiController.getUserContextForUser);

export default router;
