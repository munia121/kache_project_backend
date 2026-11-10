import { Router } from 'express';
import { UserController } from './user.controller';
import { verifyToken as auth, authorize, UserRole } from '../../middlewares/auth';

const router = Router();

// ==========================================
// User Profile Routes (Protected)
// ==========================================

/**
 * @route   GET /api/users/profile/me
 * @desc    Get profile of the currently logged-in user with nested location hierarchy
 * @access  Protected
 */
router.get('/profile/me', auth, UserController.getMyProfile);

/**
 * @route   GET /api/users/profile
 * @desc    Alias for /api/users/profile/me
 * @access  Protected
 */
router.get('/profile', auth, UserController.getMyProfile);

/**
 * @route   PATCH /api/users/profile/change-password
 * @desc    Change current user password (hashes with salt rounds 12, clears session)
 * @access  Protected
 */
router.patch('/profile/change-password', auth, UserController.changePassword);

/**
 * @route   GET /api/users/profile/my-listings
 * @desc    Get listings created by the authenticated user with filters & pagination
 * @access  Protected
 */
router.get('/profile/my-listings', auth, UserController.getMyListings);

/**
 * @route   PATCH /api/users/profile
 * @desc    Update user profile information and location hierarchy
 * @access  Protected
 */
router.patch('/profile', auth, UserController.updateProfile);

// ==========================================
// Seller Application & Approval Routes
// ==========================================

/**
 * @route   PATCH /api/users/become-seller
 * @desc    Submit application to become a seller (Sets status: PENDING, keeps role: USER)
 * @access  Protected (Authenticated user)
 */
router.patch('/become-seller', auth, UserController.becomeSeller);

/**
 * @route   GET /api/users/seller-applications
 * @desc    List seller onboarding applications (supports filters: status, search, pagination)
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.get(
  '/seller-applications',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  UserController.getSellerApplications
);

/**
 * @route   GET /api/users/seller-applications/:id
 * @desc    Get details of a single seller application
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.get(
  '/seller-applications/:id',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  UserController.getSellerApplicationById
);

/**
 * @route   PATCH /api/users/seller-applications/:id
 * @desc    Review seller application (approve or reject via { status: "APPROVED" | "REJECTED" })
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.patch(
  '/seller-applications/:id',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  UserController.reviewSellerApplication
);

/**
 * @route   PATCH /api/users/seller-applications/:id/approve
 * @desc    Approve seller application (sets sellerStatus: APPROVED, role: SELLER)
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.patch(
  '/seller-applications/:id/approve',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  UserController.approveSellerApplication
);

/**
 * @route   PATCH /api/users/seller-applications/:id/reject
 * @desc    Reject seller application (sets sellerStatus: REJECTED, keeps role: USER)
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.patch(
  '/seller-applications/:id/reject',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  UserController.rejectSellerApplication
);

/**
 * @route   PATCH /api/users/seller-applications/:id/revoke
 * @desc    Revoke seller privilege (demotes to USER, sets sellerStatus: REJECTED, archives live products)
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.patch(
  '/seller-applications/:id/revoke',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  UserController.revokeSellerApplication
);

export const UserRoutes = router;
export default router;
