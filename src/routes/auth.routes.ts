import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  signupValidation,
  signinValidation,
  validate,
} from '../middleware/validate.middleware';

const router = Router();
const authController = new AuthController();

router.post('/signup', signupValidation, validate, (req: Request, res: Response) =>
  authController.signup(req, res)
);

router.post('/signin', signinValidation, validate, (req: Request, res: Response) =>
  authController.signin(req, res)
);

router.get('/me', authenticate, (req: Request, res: Response) => authController.getMe(req, res));

export default router;

