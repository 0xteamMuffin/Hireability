import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/user', settingsController.getUserDetails);
router.put('/user', settingsController.updateUserDetails);
router.put('/password', settingsController.updatePassword);
router.get('/preferences', settingsController.getSettings);
router.put('/preferences', settingsController.updateSettings);
router.delete('/account', settingsController.deleteAccount);

export default router;
