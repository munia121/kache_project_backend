import { Request, Response } from 'express';
import config from '../../config';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import validateUUID from '../../utils/validateUUID';
import UserService from './user.service';
import {
  updateProfileZodSchema,
  changePasswordZodSchema,
  myListingsQueryZodSchema,
  becomeSellerZodSchema,
  reviewSellerApplicationZodSchema,
  revokeSellerApplicationZodSchema,
  sellerApplicationQueryZodSchema,
} from './user.validation';

/**
 * Get profile of currently authenticated user with populated location hierarchy
 * GET /api/users/profile/me
 */
export const getMyProfile = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const userProfile = await UserService.getMyProfile(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User profile retrieved successfully',
      data: userProfile,
    });
  }
);

/**
 * Update authenticated user profile and location
 * PATCH /api/users/profile
 */
export const updateProfile = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const validationResult = updateProfileZodSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map((issue) => issue.message)
        .join(', ');
      throw new AppError(400, errorMsg);
    }

    const updatedProfile = await UserService.updateProfile(
      userId,
      validationResult.data
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User profile updated successfully',
      data: updatedProfile,
    });
  }
);

/**
 * Change authenticated user's password
 * Hashes new password with 12 salt rounds and invalidates active session/refresh tokens
 * PATCH /api/users/profile/change-password
 */
export const changePassword = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const validationResult = changePasswordZodSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map((issue) => issue.message)
        .join(', ');
      throw new AppError(400, errorMsg);
    }

    await UserService.changePassword(userId, validationResult.data);

    // Invalidate refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
    });
    res.clearCookie('refreshToken');

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Password changed successfully',
      data: null,
    });
  }
);

/**
 * Retrieve listings created by the authenticated user
 * Supports status filter and pagination
 * GET /api/users/profile/my-listings
 */
export const getMyListings = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const validationResult = myListingsQueryZodSchema.safeParse(req.query);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map((issue) => issue.message)
        .join(', ');
      throw new AppError(400, errorMsg);
    }

    const result = await UserService.getMyListings(
      userId,
      validationResult.data
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User listings retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

/**
 * Onboard regular user as a seller (Submit seller application)
 * PATCH /api/users/become-seller
 */
export const becomeSeller = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const validationResult = becomeSellerZodSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map((issue) => issue.message)
        .join(', ');
      throw new AppError(400, errorMsg);
    }

    const updatedUser = await UserService.becomeSeller(
      userId,
      validationResult.data
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Seller application submitted successfully. Your application is pending admin approval.',
      data: updatedUser,
    });
  }
);

/**
 * Get list of seller applications (Admin/SuperAdmin only)
 * GET /api/users/seller-applications
 */
export const getSellerApplications = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const validationResult = sellerApplicationQueryZodSchema.safeParse(req.query);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map((issue) => issue.message)
        .join(', ');
      throw new AppError(400, errorMsg);
    }

    const result = await UserService.getSellerApplications(validationResult.data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Seller applications retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

/**
 * Get details of a single seller application (Admin/SuperAdmin only)
 * GET /api/users/seller-applications/:id
 */
export const getSellerApplicationById = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = validateUUID(req.params.id, 'user id');

    const application = await UserService.getSellerApplicationById(targetUserId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Seller application details retrieved successfully',
      data: application,
    });
  }
);

/**
 * Review seller application (Approve or Reject) (Admin/SuperAdmin only)
 * PATCH /api/users/seller-applications/:id
 */
export const reviewSellerApplication = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = validateUUID(req.params.id, 'user id');

    const validationResult = reviewSellerApplicationZodSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map((issue) => issue.message)
        .join(', ');
      throw new AppError(400, errorMsg);
    }

    const updatedUser = await UserService.reviewSellerApplication(
      targetUserId,
      validationResult.data
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `Seller application ${validationResult.data.status.toLowerCase()} successfully`,
      data: updatedUser,
    });
  }
);

/**
 * Explicit approve endpoint
 * PATCH /api/users/seller-applications/:id/approve
 */
export const approveSellerApplication = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = validateUUID(req.params.id, 'user id');

    const updatedUser = await UserService.reviewSellerApplication(targetUserId, {
      status: 'APPROVED',
    });

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Seller application approved successfully. User role upgraded to SELLER.',
      data: updatedUser,
    });
  }
);

/**
 * Explicit reject endpoint
 * PATCH /api/users/seller-applications/:id/reject
 */
export const rejectSellerApplication = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = validateUUID(req.params.id, 'user id');

    const updatedUser = await UserService.reviewSellerApplication(targetUserId, {
      status: 'REJECTED',
    });

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Seller application rejected.',
      data: updatedUser,
    });
  }
);

/**
 * Revoke seller privilege and demote user back to regular USER (Admin/SuperAdmin only)
 * PATCH /api/users/seller-applications/:id/revoke
 */
export const revokeSellerApplication = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const targetUserId = validateUUID(req.params.id, 'user id');

    if (req.body && Object.keys(req.body).length > 0) {
      const validationResult = revokeSellerApplicationZodSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMsg = validationResult.error.issues
          .map((issue) => issue.message)
          .join(', ');
        throw new AppError(400, errorMsg);
      }
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

    await UserService.revokeSellerApplication(targetUserId, reason);

    res.status(200).json({
      success: true,
      message: 'সেলার সুবিধা সফলভাবে বাতিল করা হয়েছে এবং পণ্যসমূহ হাইড করা হয়েছে।',
    });
  }
);

export const UserController = {
  getMyProfile,
  updateProfile,
  changePassword,
  getMyListings,
  becomeSeller,
  getSellerApplications,
  getSellerApplicationById,
  reviewSellerApplication,
  approveSellerApplication,
  rejectSellerApplication,
  revokeSellerApplication,
};

export default UserController;
