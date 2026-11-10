import http, { Server } from 'http';
import app from './app';
import config from './config';
import { prisma, pool } from './config/prismaClient';
import { redis } from './config/redis';
import { initSocket } from './socket';

let server: Server;

const main = async () => {
  try {
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    server = httpServer.listen(config.port, () => {
      console.log(`🚀 Server is running on port ${config.port}`);
      console.log(`📍 Health Check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  const exitHandler = async () => {
    try {
      if (server) {
        server.close(async () => {
          console.log('Server closed gracefully');
          await prisma.$disconnect();
          await pool.end();
          await redis.quit();
          process.exit(1);
        });
      } else {
        await prisma.$disconnect();
        await pool.end();
        await redis.quit();
        process.exit(1);
      }
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  const unexpectedErrorHandler = (error: unknown) => {
    console.error('Unexpected error detected:', error);
    exitHandler();
  };

  process.on('uncaughtException', unexpectedErrorHandler);
  process.on('unhandledRejection', unexpectedErrorHandler);

  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server gracefully...');
    if (server) {
      server.close();
    }
  });
};

main();
