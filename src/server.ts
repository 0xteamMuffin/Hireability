import { createServer } from 'http';
import app from './app';
import { initializeSocketServer } from './services/socket.service';

const PORT = process.env.PORT || 3001;

// Create HTTP server from Express app
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocketServer(httpServer);

// Export for use in other services
export { io };

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server initialized`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

