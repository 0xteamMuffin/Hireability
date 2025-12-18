/**
 * Socket.io Service
 * Real-time WebSocket communication for interview state sync
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import {
  SocketEvent,
  InterviewStateSnapshot,
  CodingState,
  CodeExecutionResult,
  InterviewPhase,
  QuestionState,
  AnswerEvaluationResponse,
} from '../types/interview-state.types';
import * as interviewStateService from './interview-state.service';

let io: Server | null = null;

// Track which users are in which interview rooms
const interviewRooms = new Map<string, Set<string>>(); // interviewId -> Set<socketId>

/**
 * Initialize Socket.io server
 */
export const initializeSocketServer = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Handle joining an interview room
    socket.on(SocketEvent.JOIN_INTERVIEW, handleJoinInterview(socket));

    // Handle leaving an interview room
    socket.on(SocketEvent.LEAVE_INTERVIEW, handleLeaveInterview(socket));

    // Handle code updates from frontend (for coding rounds)
    socket.on(SocketEvent.CODE_UPDATE, handleCodeUpdate(socket));

    // Handle expression updates from frontend (facial detection)
    socket.on(SocketEvent.EXPRESSION_UPDATE, handleExpressionUpdate(socket));

    // Handle state request
    socket.on(SocketEvent.REQUEST_STATE, handleRequestState(socket));

    // Handle disconnect
    socket.on('disconnect', handleDisconnect(socket));
  });

  console.log('[Socket] WebSocket server initialized');
  return io;
};

/**
 * Get the Socket.io server instance
 */
export const getIO = (): Server | null => io;

// ============================================================================
// EVENT HANDLERS
// ============================================================================

const handleJoinInterview = (socket: Socket) => {
  return (data: { interviewId: string; userId: string }) => {
    const { interviewId, userId } = data;
    
    // Join the room
    socket.join(`interview:${interviewId}`);
    
    // Track the connection
    if (!interviewRooms.has(interviewId)) {
      interviewRooms.set(interviewId, new Set());
    }
    interviewRooms.get(interviewId)!.add(socket.id);
    
    // Store user info on socket
    socket.data.interviewId = interviewId;
    socket.data.userId = userId;
    
    console.log(`[Socket] User ${userId} joined interview ${interviewId}`);
    
    // Send current state to the client (wrapped in { state: ... } to match expected format)
    const state = interviewStateService.getStateSnapshot(interviewId);
    if (state) {
      socket.emit(SocketEvent.STATE_UPDATE, { state });
    }
  };
};

const handleLeaveInterview = (socket: Socket) => {
  return (data: { interviewId: string }) => {
    const { interviewId } = data;
    
    socket.leave(`interview:${interviewId}`);
    
    // Remove from tracking
    const room = interviewRooms.get(interviewId);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        interviewRooms.delete(interviewId);
      }
    }
    
    console.log(`[Socket] Socket ${socket.id} left interview ${interviewId}`);
  };
};

const handleCodeUpdate = (socket: Socket) => {
  return (data: { code: string; language: string }) => {
    const interviewId = socket.data.interviewId;
    if (!interviewId) return;
    
    // Update interview state with new code
    interviewStateService.updateCodingState(interviewId, {
      code: data.code,
      language: data.language,
    });
    
    // Update candidate signals
    interviewStateService.updateCandidateSignals(interviewId, {
      isTyping: true,
      lastCodeUpdate: new Date(),
      codeLength: data.code.length,
    });
    
    // Broadcast to other clients in the room (if any)
    socket.to(`interview:${interviewId}`).emit(SocketEvent.CODE_UPDATE, data);
  };
};

const handleExpressionUpdate = (socket: Socket) => {
  return (data: { expression: string; confidence: number; averageExpressions?: Record<string, number> }) => {
    const interviewId = socket.data.interviewId;
    if (!interviewId) return;
    
    // Update candidate signals
    interviewStateService.updateCandidateSignals(interviewId, {
      currentExpression: data.expression,
      expressionConfidence: data.confidence,
      averageExpressions: data.averageExpressions,
    });
  };
};

const handleRequestState = (socket: Socket) => {
  return (data: { interviewId: string }) => {
    const state = interviewStateService.getStateSnapshot(data.interviewId);
    if (state) {
      socket.emit(SocketEvent.STATE_UPDATE, state);
    }
  };
};

const handleDisconnect = (socket: Socket) => {
  return () => {
    const interviewId = socket.data.interviewId;
    
    if (interviewId) {
      const room = interviewRooms.get(interviewId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          interviewRooms.delete(interviewId);
        }
      }
    }
    
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  };
};

// ============================================================================
// EMIT FUNCTIONS (Called from other services)
// ============================================================================

/**
 * Emit state update to all clients in an interview room
 */
export const emitStateUpdate = (interviewId: string): void => {
  console.log('[Socket] emitStateUpdate called for:', interviewId, 'io exists:', !!io);
  if (!io) {
    console.warn('[Socket] Cannot emit - io is null');
    return;
  }
  
  const state = interviewStateService.getStateSnapshot(interviewId);
  console.log('[Socket] State found:', !!state, 'phase:', state?.phase);
  if (state) {
    io.to(`interview:${interviewId}`).emit(SocketEvent.STATE_UPDATE, { state });
    console.log('[Socket] Emitted STATE_UPDATE to room:', `interview:${interviewId}`);
  }
};

/**
 * Emit when a question is asked
 */
export const emitQuestionAsked = (interviewId: string, question: QuestionState): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.QUESTION_ASKED, { question });
};

/**
 * Emit answer evaluation result
 */
export const emitAnswerEvaluated = (
  interviewId: string,
  evaluation: AnswerEvaluationResponse
): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.ANSWER_EVALUATED, evaluation);
};

/**
 * Emit when a coding problem is assigned
 */
export const emitCodingProblemAssigned = (
  interviewId: string,
  problem: CodingState
): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.CODING_PROBLEM_ASSIGNED, { problem });
};

/**
 * Emit code execution result
 */
export const emitCodeExecuted = (
  interviewId: string,
  result: CodeExecutionResult
): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.CODE_EXECUTED, result);
};

/**
 * Emit when a hint is provided
 */
export const emitHintProvided = (
  interviewId: string,
  hint: string,
  hintsRemaining: number
): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.HINT_PROVIDED, { hint, hintsRemaining });
};

/**
 * Emit phase change
 */
export const emitPhaseChanged = (
  interviewId: string,
  phase: InterviewPhase,
  reason: string
): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.PHASE_CHANGED, { phase, reason });
};

/**
 * Emit interview completed
 */
export const emitInterviewCompleted = (
  interviewId: string,
  summary: InterviewStateSnapshot
): void => {
  if (!io) return;
  
  io.to(`interview:${interviewId}`).emit(SocketEvent.INTERVIEW_COMPLETED, { summary });
};

/**
 * Get number of connected clients in an interview room
 */
export const getConnectedClients = (interviewId: string): number => {
  return interviewRooms.get(interviewId)?.size || 0;
};

/**
 * Check if any clients are connected to an interview
 */
export const hasConnectedClients = (interviewId: string): boolean => {
  return getConnectedClients(interviewId) > 0;
};
