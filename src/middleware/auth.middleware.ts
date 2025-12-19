import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyToken(token);
      (req as AuthRequest).user = {
        id: decoded.userId,
        email: decoded.email,
      };
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

export const authMiddleware = authenticate;
