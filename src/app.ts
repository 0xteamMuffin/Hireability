import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import documentRoutes from './routes/document.routes';
import vapiRoutes from './routes/vapi.routes';
import targetRoutes from './routes/target.routes';
import settingsRoutes from './routes/settings.routes';
import transcriptRoutes from './routes/transcript.routes';
import interviewRoutes from './routes/interview.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

dotenv.config();

const app: Express = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/vapi', vapiRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/interviews', interviewRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

