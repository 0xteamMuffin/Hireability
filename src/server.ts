import { createServer } from 'http';
import app from './app';
import { initializeSocketServer } from './services/socket.service';

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);

const io = initializeSocketServer(httpServer);

export { io };

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server initialized`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
