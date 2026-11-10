import { Router } from 'express';
import { verifyToken } from '../middlewares/auth';
import { CartController } from '../controllers/cart.controller';
import {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
  validateRequest,
} from '../validators/cart.validator';

const router = Router();

// Enforce authentication for all cart operations
router.use(verifyToken);

/**
 * @route   POST /api/cart/sync
 * @desc    Batch sync guest cart from frontend localStorage to DB
 * @access  Protected
 */
router.post('/sync', validateRequest(syncCartSchema), CartController.syncCart);

/**
 * @route   GET /api/cart
 * @desc    Get the current user's cart with calculated dynamic totals
 * @access  Protected
 */
router.get('/', CartController.getCart);
router.get('/me', CartController.getCart);

/**
 * @route   POST /api/cart/items or POST /api/cart
 * @desc    Add product to user's cart
 * @access  Protected
 */
router.post('/items', validateRequest(addToCartSchema), CartController.addToCart);
router.post('/add', validateRequest(addToCartSchema), CartController.addToCart);
router.post('/', validateRequest(addToCartSchema), CartController.addToCart);

/**
 * @route   PATCH /api/cart/items/:id or PUT /api/cart/items/:id
 * @desc    Update quantity of a cart item (or productId)
 * @access  Protected
 */
router.patch(
  '/items/:id',
  validateRequest(updateCartItemSchema),
  CartController.updateCartItemQuantity
);
router.put(
  '/items/:id',
  validateRequest(updateCartItemSchema),
  CartController.updateCartItemQuantity
);

/**
 * @route   DELETE /api/cart/items/:id
 * @desc    Remove an item from the cart (by cartItem ID or productId)
 * @access  Protected
 */
router.delete('/items/:id', CartController.removeFromCart);

/**
 * @route   DELETE /api/cart or DELETE /api/cart/clear
 * @desc    Clear all items in the user's cart
 * @access  Protected
 */
router.delete('/clear', CartController.clearCart);
router.delete('/', CartController.clearCart);

export const CartRoutes = router;
export default router;
