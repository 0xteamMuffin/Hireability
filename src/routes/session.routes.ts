/**
 * Session Routes
 * Multi-round interview session management
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as sessionController from '../controllers/session.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Session management
router.post('/', sessionController.createSession);
router.get('/', sessionController.getSessions);
router.get('/active', sessionController.getActiveSession);
router.get('/multi-round-enabled', sessionController.checkMultiRoundEnabled);
router.get('/:sessionId', sessionController.getSession);
router.delete('/:sessionId', sessionController.deleteSession);
router.post('/:sessionId/abandon', sessionController.abandonSession);

// Round management
router.post('/round/start', sessionController.startRound);
router.post('/round/complete', sessionController.completeRound);
router.post('/:sessionId/round/:roundId/skip', sessionController.skipRound);

export default router;
