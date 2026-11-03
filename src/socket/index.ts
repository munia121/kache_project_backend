import { Server as HttpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { socketAuthMiddleware } from './socket.middleware';
import { registerSocketHandlers } from './socket.handler';
import { AuthenticatedSocket } from './socket.interface';

let ioInstance: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  const options: Partial<ServerOptions> = {
    cors: {
      origin: '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  };

  const io = new Server(httpServer, options);

  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection listener
  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket as AuthenticatedSocket);
  });

  ioInstance = io;
  console.log('⚡ [Socket.IO] Server initialized and listening for connections');

  return io;
};

export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized. Please call initSocket first.');
  }
  return ioInstance;
};

export { ioInstance as io };
export * from './socket.interface';
