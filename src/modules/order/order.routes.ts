import { Router } from 'express';
import { verifyToken, authorize } from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import OrderController from './order.controller';
import {
  createOrderZodSchema,
  updateOrderStatusZodSchema,
  validateRequest,
} from './order.validation';

const router = Router();

// Enforce authentication for all order operations
router.use(verifyToken);

/**
 * @route   GET /api/orders/admin
 * @desc    Get all orders across the platform (Admin only)
 * @access  Protected (ADMIN, SUPER_ADMIN)
 */
router.get(
  '/admin',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  OrderController.getAllOrders
);

/**
 * @route   GET /api/orders/seller
 * @desc    Get all orders containing seller's products
 * @access  Protected (SELLER, ADMIN, SUPER_ADMIN)
 */
router.get(
  '/seller',
  authorize(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  OrderController.getSellerOrders
);

/**
 * @route   POST /api/orders/checkout or POST /api/orders
 * @desc    Place a Cash on Delivery (COD) order
 * @access  Protected (All authenticated users)
 */
router.post('/checkout', validateRequest(createOrderZodSchema), OrderController.checkout);
router.post('/', validateRequest(createOrderZodSchema), OrderController.checkout);

/**
 * @route   GET /api/orders or GET /api/orders/my-orders or GET /api/orders/me
 * @desc    Get order history for current user
 * @access  Protected (All authenticated users)
 */
router.get('/my-orders', OrderController.getMyOrders);
router.get('/me', OrderController.getMyOrders);
router.get('/', OrderController.getMyOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order details by ID
 * @access  Protected (Buyer, Seller of item, Admin)
 */
router.get('/:id', OrderController.getOrderById);

/**
 * @route   PATCH /api/orders/:id/cancel
 * @desc    Cancel an order and restore product stock
 * @access  Protected (Buyer, Admin)
 */
router.patch('/:id/cancel', OrderController.cancelOrder);
router.put('/:id/cancel', OrderController.cancelOrder);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    Update order status / payment status
 * @access  Protected (Seller of item, Admin)
 */
router.patch(
  '/:id/status',
  validateRequest(updateOrderStatusZodSchema),
  OrderController.updateOrderStatus
);
router.put(
  '/:id/status',
  validateRequest(updateOrderStatusZodSchema),
  OrderController.updateOrderStatus
);

export const OrderRoutes = router;
export default router;
