import { UserStatus } from '@prisma/client';
import prisma from '../config/prismaClient';
import { verifyJwtToken } from '../utils/auth';
import { AuthenticatedSocket } from './socket.interface';

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    let token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: Token required'));
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    let decoded: any;
    try {
      decoded = verifyJwtToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Token has expired'));
      }
      return next(new Error('Authentication error: Invalid or corrupted token'));
    }

    if (!decoded || !decoded.id) {
      return next(new Error('Authentication error: Invalid token payload'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        phone: true,
        role: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      return next(new Error('Authentication error: User does not exist'));
    }

    if (user.status !== UserStatus.ACTIVE) {
      return next(
        new Error(`Authentication error: Account is not active (${user.status})`)
      );
    }

    socket.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (error: any) {
    next(new Error(`Authentication failed: ${error.message || 'Unknown error'}`));
  }
};
