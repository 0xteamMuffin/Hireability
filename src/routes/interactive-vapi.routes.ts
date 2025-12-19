/**
 * Interactive VAPI Routes
 * Endpoints for VAPI tool calls in adaptive interviews
 *
 * These routes are called by VAPI when the assistant invokes tools.
 * No auth middleware - VAPI includes userId in the call metadata.
 */

import { Router } from 'express';
import * as interactiveVapiController from '../controllers/interactive-vapi.controller';

const router = Router();

router.post('/initializeInterview', interactiveVapiController.initializeInterview);

router.post('/completeInterview', interactiveVapiController.completeInterview);

router.post('/getNextQuestion', interactiveVapiController.getNextQuestion);

router.post('/evaluateAnswer', interactiveVapiController.evaluateAnswer);

router.post('/getInterviewState', interactiveVapiController.getInterviewState);

router.post('/shouldWrapUp', interactiveVapiController.shouldWrapUp);

router.post('/presentCodingProblem', interactiveVapiController.presentCodingProblem);
router.post('/checkCodeProgress', interactiveVapiController.checkCodeProgress);
router.post('/executeCode', interactiveVapiController.executeCode);
router.post('/getCodingHint', interactiveVapiController.getCodingHint);

export default router;
