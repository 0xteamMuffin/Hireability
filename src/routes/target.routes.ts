import { Router } from 'express';
import * as targetController from '../controllers/target.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', targetController.getTargets);
router.get('/:id', targetController.getTargetById);
router.post('/', targetController.createTarget);
router.put('/:id', targetController.updateTarget);
router.delete('/:id', targetController.deleteTarget);

export default router;
