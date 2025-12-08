import { Router } from 'express';
import multer from 'multer';
import * as documentController from '../controllers/document.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.use(authMiddleware);

router.post('/resume', upload.single('file'), documentController.uploadResume);
router.get('/resume', documentController.getResumeData);

export default router;
