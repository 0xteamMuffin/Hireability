import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as transcriptController from '../controllers/transcript.controller';

const router = Router();

router.post('/', authMiddleware, transcriptController.saveTranscript);

export default router;
