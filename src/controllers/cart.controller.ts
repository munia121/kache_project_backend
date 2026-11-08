import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import AppError from '../errors/AppError';
import CartService from '../services/cart.service';

/**
 * Controller to fetch the authenticated user's cart
 * GET /api/cart
 */
export const getCart = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const cart = await CartService.getCart(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Cart retrieved successfully',
    data: cart,
  });
});

/**
 * Controller to add an item to the authenticated user's cart
 * POST /api/cart/items or POST /api/cart
 */
export const addToCart = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const { productId, quantity } = req.body;
  const cart = await CartService.addToCart(userId, { productId, quantity });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Product added to cart successfully',
    data: cart,
  });
});

/**
 * Controller to update an item's quantity in the cart
 * PATCH /api/cart/items/:id
 */
export const updateCartItemQuantity = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized: User identity not found');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { quantity } = req.body;

    const cart = await CartService.updateCartItemQuantity(userId, id, quantity);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message:
        quantity <= 0
          ? 'Item removed from cart successfully'
          : 'Cart item quantity updated successfully',
      data: cart,
    });
  }
);

/**
 * Controller to remove an item from the cart
 * DELETE /api/cart/items/:id
 */
export const removeFromCart = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized: User identity not found');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const cart = await CartService.removeFromCart(userId, id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Item removed from cart successfully',
      data: cart,
    });
  }
);

/**
 * Controller to clear all items in the authenticated user's cart
 * DELETE /api/cart
 */
export const clearCart = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const cart = await CartService.clearCart(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Cart cleared successfully',
    data: cart,
  });
});

/**
 * Controller to batch sync guest cart items (from localStorage) into DB
 * POST /api/cart/sync
 */
export const syncCart = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const { items } = req.body;
  const cart = await CartService.syncGuestCart(userId, items);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Guest cart synced successfully',
    data: cart,
  });
});

export const CartController = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  syncCart,
};

export default CartController;
