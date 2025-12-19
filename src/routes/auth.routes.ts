import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { signupValidation, signinValidation, validate } from '../middleware/validate.middleware';

const router = Router();
const authController = new AuthController();

router.post('/signup', signupValidation, validate, authController.signup.bind(authController));
router.post('/signin', signinValidation, validate, authController.signin.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));

export default router;
