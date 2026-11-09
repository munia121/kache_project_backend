import { Router } from 'express';
import { auth, authorize } from '../middlewares/auth';
import { UserRole } from '@prisma/client';
import { revokeSellerApplication } from '../controllers/admin.controller';

const router = Router();

/**
 * @route   PATCH /seller-applications/:id/revoke
 * @desc    Revoke seller privilege and demote to regular user
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.patch(
  '/seller-applications/:id/revoke',
  auth,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  revokeSellerApplication
);

export const AdminRoutes = router;
export default router;
