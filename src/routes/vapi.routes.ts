import { Router } from 'express';
import * as vapiController from '../controllers/vapi.controller';

const router = Router();

router.post('/getUserData', vapiController.getUserData);
router.post('/getResumeData', vapiController.getResumeData);
router.post('/getQuestions', vapiController.getQuestions);

export default router;
