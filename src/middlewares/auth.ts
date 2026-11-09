import { NextFunction, Request, Response } from 'express';
import { UserRole, UserStatus, SellerStatus } from '@prisma/client';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import { verifyJwtToken } from '../utils/auth';
import prisma from '../config/prismaClient';

export { UserRole, UserRole as Role, SellerStatus };

/**
 * Middleware to verify JWT token from Authorization header
 * Sets authenticated user payload on req.user
 */
export const verifyToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authorization token is required (Format: Bearer <token>)');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError(401, 'Token missing');
    }

    let decoded: any;
    try {
      decoded = verifyJwtToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError(401, 'Token has expired');
      }
      throw new AppError(401, 'Invalid or corrupted token');
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new AppError(404, 'User does not exist');
    }

    // Verify user status is ACTIVE
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError(403, `User account is not active. Current status: ${user.status}`);
    }

    // Attach decoded user information to request
    req.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      email: user.email,
      sellerStatus: user.sellerStatus,
    };

    next();
  }
);

/**
 * Express middleware to authenticate user via JWT token.
 * Can be used directly as `auth` or invoked as `auth()` in route definitions.
 */
export const auth: any = ((...args: any[]) => {
  if (args.length >= 3 && args[0]?.headers) {
    return (verifyToken as any)(args[0], args[1], args[2]);
  }
  return verifyToken;
}) as any;

/**
 * Strict role-based authorization guard
 * Restricts access to specified UserRoles.
 * If user role is USER (or not in allowed roles), immediately blocks execution with 403 Forbidden:
 * { statusCode: 403, success: false, message: "Regular users cannot post products. You must complete seller onboarding first to post ads." }
 */
export const authorizeRoles = (...roles: (UserRole | string)[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const userRole = req.user.role;

    if (roles.length > 0 && !roles.includes(userRole as UserRole)) {
      if (userRole === UserRole.USER || userRole === 'USER') {
        throw new AppError(
          403,
          'Regular users cannot post products. You must complete seller onboarding first to post ads.'
        );
      }

      throw new AppError(
        403,
        'Regular users cannot post products. You must complete seller onboarding first to post ads.'
      );
    }

    next();
  };
};

/**
 * Middleware to restrict access based on user role (general authorize)
 */
export const authorize = (...roles: (UserRole | string)[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    if (roles.length > 0 && !roles.includes(req.user.role as UserRole)) {
      throw new AppError(403, 'Forbidden: You do not have permission to perform this action');
    }

    next();
  };
};

/**
 * Middleware to optionally verify JWT token if provided
 * Sets authenticated user payload on req.user if a valid token is provided,
 * but allows guest users to continue without error.
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const decoded: any = verifyJwtToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      req.user = {
        id: user.id,
        phone: user.phone,
        role: user.role,
        email: user.email,
      };
    }
  } catch {
    // If token is invalid or expired, continue as guest without populating req.user
  }

  next();
};

export default verifyToken;

