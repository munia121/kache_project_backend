import { Prisma, ProductStatus, UserRole, SellerStatus } from '@prisma/client';
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
  IReviewSellerApplicationPayload,
  ISellerApplicationQueryOptions,
  ISellerApplicationResult,
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
 * Become a seller onboarding workflow (Application submission)
 * - Checks current status:
 *   - If already approved (or role is SELLER / ADMIN / SUPER_ADMIN), throws 400 "You are already a registered seller"
 *   - If application is already PENDING, throws 400 "Your seller application is already pending admin approval"
 * - Prerequisite check: verifies user has phone or saved areaId
 * - STAGE 1: Sets sellerStatus = 'PENDING'
 *   NON-NEGOTIABLE CONSTRAINT: DO NOT change user role to SELLER upon application submission.
 *   The role MUST remain USER (BUYER) until an Admin/SuperAdmin explicitly approves it.
 * - Updates optional shopName/bio
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

  // Check current role and approval status
  if (
    user.role === UserRole.SELLER ||
    user.sellerStatus === SellerStatus.APPROVED ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.SUPER_ADMIN
  ) {
    throw new AppError(400, 'You are already a registered seller');
  }

  if (user.sellerStatus === SellerStatus.PENDING) {
    throw new AppError(
      400,
      'Your seller application is already pending admin approval'
    );
  }

  // Prerequisite check: Verify the user has a phone number or a saved areaId (home location)
  const hasPhone = Boolean(user.phone && user.phone.trim());
  const hasAreaId = Boolean(user.areaId);

  if (!hasPhone && !hasAreaId) {
    throw new AppError(
      400,
      'Please set your default location and verify your phone number before becoming a seller'
    );
  }

  const updateData: Prisma.UserUpdateInput = {
    // Role remains USER (BUYER). DO NOT set role to SELLER here!
    sellerStatus: SellerStatus.PENDING,
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

/**
 * Get all seller applications with filter, search, and pagination (Admin only)
 */
export const getSellerApplications = async (
  query: ISellerApplicationQueryOptions = {}
): Promise<ISellerApplicationResult> => {
  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
  const parsedLimit = parseInt(String(query.limit || 10), 10) || 10;
  const limit = Math.max(1, Math.min(100, parsedLimit));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  // Status filter: default to PENDING unless ALL or specific status provided
  if (query.status && query.status.toUpperCase() !== 'ALL') {
    where.sellerStatus = query.status.toUpperCase() as SellerStatus;
  } else if (!query.status) {
    where.sellerStatus = SellerStatus.PENDING;
  } else {
    // If 'ALL', show users that have at least applied (i.e. not NONE)
    where.sellerStatus = {
      not: SellerStatus.NONE,
    };
  }

  // Search filter across fullName, phone, email, shopName
  if (query.search && query.search.trim()) {
    const searchTrimmed = query.search.trim();
    where.OR = [
      { fullName: { contains: searchTrimmed, mode: 'insensitive' } },
      { phone: { contains: searchTrimmed, mode: 'insensitive' } },
      { email: { contains: searchTrimmed, mode: 'insensitive' } },
      { shopName: { contains: searchTrimmed, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: locationHierarchyInclude,
    }),
    prisma.user.count({ where }),
  ]);

  const safeUsers = users.map((u) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = u;
    return safeUser;
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: safeUsers,
  };
};

/**
 * Get a single seller application by user ID (Admin only)
 */
export const getSellerApplicationById = async (
  targetUserId: string
): Promise<IUserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: locationHierarchyInclude,
  });

  if (!user) {
    throw new AppError(404, 'User application not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

/**
 * Review seller application (Admin/SuperAdmin only)
 * - When APPROVED: updates sellerStatus = 'APPROVED' and role = 'SELLER'
 * - When REJECTED: updates sellerStatus = 'REJECTED' (role remains USER/BUYER)
 */
export const reviewSellerApplication = async (
  targetUserId: string,
  payload: IReviewSellerApplicationPayload
): Promise<IUserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: locationHierarchyInclude,
  });

  if (!user) {
    throw new AppError(404, 'Target user profile not found');
  }

  if (payload.status === 'APPROVED') {
    if (user.sellerStatus === SellerStatus.APPROVED && user.role === UserRole.SELLER) {
      throw new AppError(400, 'User is already an approved seller');
    }
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (payload.status === 'APPROVED') {
    updateData.sellerStatus = SellerStatus.APPROVED;
    updateData.role = UserRole.SELLER;
  } else if (payload.status === 'REJECTED') {
    updateData.sellerStatus = SellerStatus.REJECTED;
    if (payload.reason) {
      updateData.rejectionReason = payload.reason;
    }
    // Ensure role is USER
    if (user.role === UserRole.SELLER) {
      updateData.role = UserRole.USER;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: updateData,
    include: locationHierarchyInclude,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = updatedUser;
  return safeUser;
};

/**
 * Revoke seller privilege and demote user back to regular USER (Admin/SuperAdmin only)
 * - Verifies that target user exists and currently has role === 'SELLER' or sellerStatus === 'APPROVED'
 * - In a Prisma transaction:
 *   1. Demotes user role from SELLER to USER, updates sellerStatus to REJECTED, and records rejectionReason
 *   2. Deactivates all existing products of this seller (status: ARCHIVED)
 */
export const revokeSellerApplication = async (
  userId: string,
  reason?: string
): Promise<{ demotedUser: IUserProfileResponse; updatedProductsCount: number }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: locationHierarchyInclude,
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const isSeller =
    user.role === UserRole.SELLER || user.sellerStatus === SellerStatus.APPROVED;
  if (!isSeller) {
    throw new AppError(400, 'User is not an active or approved seller');
  }

  const defaultReason =
    'অ্যাডমিন কর্তৃক সেলার অ্যাকাউন্ট স্থগিত বা বাতিল করা হয়েছে।';
  const finalReason =
    reason && reason.trim().length > 0 ? reason.trim() : defaultReason;

  const [demotedUser, updatedProducts] = await prisma.$transaction([
    // 1. Demote user role and set status to REJECTED
    prisma.user.update({
      where: { id: userId },
      data: {
        role: UserRole.USER,
        sellerStatus: SellerStatus.REJECTED,
        rejectionReason: finalReason,
      },
      include: locationHierarchyInclude,
    }),
    // 2. Hide all live products of this revoked seller
    prisma.product.updateMany({
      where: { sellerId: userId },
      data: {
        status: ProductStatus.ARCHIVED,
      },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = demotedUser;
  return {
    demotedUser: safeUser,
    updatedProductsCount: updatedProducts.count,
  };
};

export const UserService = {
  getMyProfile,
  updateProfile,
  changePassword,
  getMyListings,
  becomeSeller,
  getSellerApplications,
  getSellerApplicationById,
  reviewSellerApplication,
  revokeSellerApplication,
};

export default UserService;
