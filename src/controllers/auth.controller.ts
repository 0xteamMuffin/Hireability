import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { SignupRequest, SigninRequest } from '../types/auth.types';

const authService = new AuthService();

export class AuthController {
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const data: SignupRequest = req.body;
      const result = await authService.signup(data);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  }

  async signin(req: Request, res: Response): Promise<void> {
    try {
      const data: SigninRequest = req.body;
      const result = await authService.signin(data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signin failed';
      res.status(401).json({
        success: false,
        error: message,
      });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const user = await authService.getUserById(userId);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get user';
      res.status(404).json({
        success: false,
        error: message,
      });
    }
  }
}

