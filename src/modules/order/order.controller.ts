import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../errors/AppError';
import OrderService from './order.service';

/**
 * Place a new Order using Cash on Delivery (COD)
 * POST /api/orders or POST /api/orders/checkout
 */
export const checkout = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const order = await OrderService.createOrder(userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Order placed successfully via Cash on Delivery (COD)',
    data: order,
  });
});

/**
 * Get current authenticated user's order history
 * GET /api/orders or GET /api/orders/my-orders
 */
export const getMyOrders = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const result = await OrderService.getMyOrders(userId, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

/**
 * Get single order by ID
 * GET /api/orders/:id
 */
export const getOrderById = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user || !user.id) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = await OrderService.getOrderById(id, user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order retrieved successfully',
    data: order,
  });
});

/**
 * Cancel an order and restore product stock
 * PATCH /api/orders/:id/cancel
 */
export const cancelOrder = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user || !user.id) {
    throw new AppError(401, 'Unauthorized: User identity not found');
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = await OrderService.cancelOrder(id, user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Order cancelled successfully and stock restored',
    data: order,
  });
});

/**
 * Update order status (ADMIN or Seller)
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user || !user.id) {
      throw new AppError(401, 'Unauthorized: User identity not found');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await OrderService.updateOrderStatus(id, req.body, user);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  }
);

/**
 * Admin: Get all orders across the platform
 * GET /api/orders/admin
 */
export const getAllOrders = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const result = await OrderService.getAllOrders(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All platform orders retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

/**
 * Seller: Get orders containing the seller's products
 * GET /api/orders/seller
 */
export const getSellerOrders = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = req.user?.id;
    if (!sellerId) {
      throw new AppError(401, 'Unauthorized: User identity not found');
    }

    const result = await OrderService.getSellerOrders(sellerId, req.query);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Seller orders retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

export const OrderController = {
  checkout,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  getAllOrders,
  getSellerOrders,
};

export default OrderController;
