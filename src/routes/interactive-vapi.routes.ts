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

// ============================================================================
// INTERVIEW LIFECYCLE
// ============================================================================

// Initialize interview state at call start
router.post('/initializeInterview', interactiveVapiController.initializeInterview);

// Complete interview at call end
router.post('/completeInterview', interactiveVapiController.completeInterview);

// ============================================================================
// ADAPTIVE QUESTIONING
// ============================================================================

// Get next adaptive question based on interview state
router.post('/getNextQuestion', interactiveVapiController.getNextQuestion);

// Evaluate candidate's answer
router.post('/evaluateAnswer', interactiveVapiController.evaluateAnswer);

// ============================================================================
// INTERVIEW STATE
// ============================================================================

// Get current interview state snapshot
router.post('/getInterviewState', interactiveVapiController.getInterviewState);

// Check if interview should wrap up
router.post('/shouldWrapUp', interactiveVapiController.shouldWrapUp);

// ============================================================================
// CODING ROUND
// ============================================================================

// Present a coding problem to the candidate
router.post('/presentCodingProblem', interactiveVapiController.presentCodingProblem);
router.post('/checkCodeProgress', interactiveVapiController.checkCodeProgress);
router.post('/executeCode', interactiveVapiController.executeCode);
router.post('/getCodingHint', interactiveVapiController.getCodingHint);

export default router;
