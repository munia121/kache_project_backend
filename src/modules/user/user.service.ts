import { Prisma, ProductStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../../config/prismaClient';
import redis from '../../config/redis';
import AppError from '../../errors/AppError';
import {
  IUpdateProfilePayload,
  IChangePasswordPayload,
  IMyListingsFilterOptions,
  IMyListingsResult,
  IUserProfileResponse,
  IBecomeSellerPayload,
} from './user.interface';

/**
 * Common include object for populating nested location hierarchy
 */
const locationHierarchyInclude = {
  locationArea: {
    include: {
      district: {
        include: {
          division: true,
        },
      },
    },
  },
};

/**
 * Retrieve user profile by user ID with populated location hierarchy
 * Strips passwordHash
 */
export const getMyProfile = async (userId: string): Promise<IUserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: locationHierarchyInclude,
  });

  if (!user) {
    throw new AppError(404, 'User profile not found');
  }

  // Strip sensitive password hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

/**
 * Update user profile information (fullName, avatar, areaId, address)
 * Verifies areaId exists if provided
 * Returns updated profile with populated location hierarchy
 */
export const updateProfile = async (
  userId: string,
  payload: IUpdateProfilePayload
): Promise<IUserProfileResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new AppError(404, 'User profile not found');
  }

  let areaRecord = null;
  if (payload.areaId !== undefined && payload.areaId !== null) {
    areaRecord = await prisma.area.findUnique({
      where: { id: payload.areaId },
    });

    if (!areaRecord) {
      throw new AppError(404, `Area with id '${payload.areaId}' not found`);
    }
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (payload.fullName !== undefined) {
    updateData.fullName = payload.fullName.trim();
  }

  if (payload.avatar !== undefined) {
    updateData.avatar = payload.avatar ? payload.avatar.trim() : null;
  }

  if (payload.areaId !== undefined) {
    if (payload.areaId === null) {
      updateData.locationArea = { disconnect: true };
      updateData.area = null;
    } else {
      updateData.locationArea = { connect: { id: payload.areaId } };
      if (areaRecord) {
        updateData.area = areaRecord.name;
      }
    }
  }

  if (payload.address !== undefined) {
    updateData.address = payload.address ? payload.address.trim() : null;
  }

  if (payload.role !== undefined) {
    if (
      existingUser.role !== UserRole.ADMIN &&
      existingUser.role !== UserRole.SUPER_ADMIN
    ) {
      if (payload.role === 'USER' || payload.role === UserRole.USER) {
        updateData.role = UserRole.USER;
      } else if (payload.role === 'SELLER' || payload.role === UserRole.SELLER) {
        updateData.role = UserRole.SELLER;
      }
    }
  }

  if (payload.shopName !== undefined) {
    updateData.shopName = payload.shopName ? payload.shopName.trim() : null;
  }

  if (payload.bio !== undefined) {
    updateData.bio = payload.bio ? payload.bio.trim() : null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: locationHierarchyInclude,
  });

  // Strip sensitive password hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = updatedUser;
  return safeUser;
};

/**
 * Change user password
 * Validates current password, hashes new password with 12 salt rounds,
 * and clears any active tracked sessions
 */
export const changePassword = async (
  userId: string,
  payload: IChangePasswordPayload
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Compare old password with stored hash
  const isMatch = await bcrypt.compare(payload.oldPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError(400, 'Incorrect current password');
  }

  // Hash new password using 12 salt rounds
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(payload.newPassword, saltRounds);

  // Update password in database
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newPasswordHash,
    },
  });

  // Invalidate any active tracked sessions / refresh tokens in Redis if stored
  try {
    await redis.del(`refreshToken:${userId}`);
    await redis.del(`session:${userId}`);
  } catch {
    // Non-blocking in case Redis key does not exist or Redis is offline
  }
};

/**
 * Get listings belonging to the authenticated user
 * Supports status filter and pagination
 * Includes category and nested area hierarchy
 */
export const getMyListings = async (
  userId: string,
  filters: IMyListingsFilterOptions = {}
): Promise<IMyListingsResult> => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    sellerId: userId,
  };

  if (filters.status) {
    const normalized = String(filters.status).toUpperCase();
    if (Object.values(ProductStatus).includes(normalized as ProductStatus)) {
      where.status = normalized as ProductStatus;
    }
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        area: {
          include: {
            district: {
              include: {
                division: true,
              },
            },
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: products,
  };
};

/**
 * Become a seller onboarding workflow
 * - Checks current role: if already SELLER or ADMIN (or SUPER_ADMIN), throws 400 "You are already a registered seller"
 * - Prerequisite check: verifies user has verified phone or saved areaId, else throws 400 "Please set your default location and verify your phone number before becoming a seller"
 * - Updates role = 'SELLER' and optional shopName/bio
 * - Returns updated user object (excluding passwordHash) with populated locationArea hierarchy
 */
export const becomeSeller = async (
  userId: string,
  payload: IBecomeSellerPayload
): Promise<IUserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: locationHierarchyInclude,
  });

  if (!user) {
    throw new AppError(404, 'User profile not found');
  }

  // Check current role: If already SELLER or ADMIN (or SUPER_ADMIN)
  if (
    user.role === UserRole.SELLER ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.SUPER_ADMIN ||
    (user.role as string) === 'SELLER' ||
    (user.role as string) === 'ADMIN' ||
    (user.role as string) === 'SUPER_ADMIN'
  ) {
    throw new AppError(400, 'You are already a registered seller');
  }

  // Prerequisite check: Verify the user has a verified phone number or a saved areaId (home location)
  const hasPhone = Boolean(user.phone && user.phone.trim());
  const hasAreaId = Boolean(user.areaId);

  if (!hasPhone && !hasAreaId) {
    throw new AppError(
      400,
      'Please set your default location and verify your phone number before becoming a seller'
    );
  }

  const updateData: Prisma.UserUpdateInput = {
    role: UserRole.SELLER,
  };

  if (payload.shopName !== undefined && payload.shopName !== null) {
    updateData.shopName = payload.shopName.trim();
  }

  if (payload.bio !== undefined && payload.bio !== null) {
    updateData.bio = payload.bio.trim();
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: locationHierarchyInclude,
  });

  // Strip sensitive password hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = updatedUser;
  return safeUser;
};

export const UserService = {
  getMyProfile,
  updateProfile,
  changePassword,
  getMyListings,
  becomeSeller,
};

export default UserService;
