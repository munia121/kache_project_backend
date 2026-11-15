import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';

export const checkoutItemSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid({ message: 'Invalid product ID format. Must be a valid UUID' }),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int({ message: 'Quantity must be an integer' })
    .min(1, { message: 'Quantity must be at least 1' }),
});

export const createOrderZodSchema = z.object({
  body: z.object({
    shippingAddress: z
      .string({ required_error: 'Shipping address is required' })
      .min(3, { message: 'Shipping address must be at least 3 characters long' }),
    paymentMethod: z
      .nativeEnum(PaymentMethod, {
        errorMap: () => ({ message: 'Payment method is strictly COD (Cash on Delivery)' }),
      })
      .default(PaymentMethod.COD)
      .optional(),
    items: z.array(checkoutItemSchema).optional(),
  }),
});

export const updateOrderStatusZodSchema = z.object({
  body: z
    .object({
      status: z.nativeEnum(OrderStatus).optional(),
      paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    })
    .refine((data) => data.status !== undefined || data.paymentStatus !== undefined, {
      message: 'At least one of status or paymentStatus must be provided for update',
    }),
});

export const orderQueryZodSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      status: z.nativeEnum(OrderStatus).optional(),
      paymentStatus: z.nativeEnum(PaymentStatus).optional(),
      sortBy: z.enum(['createdAt', 'totalAmount', 'updatedAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      search: z.string().optional(),
      userId: z.string().uuid().optional(),
    })
    .optional(),
});

/**
 * Express middleware to validate requests with Zod schemas
 */
export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed: any = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body) {
        req.body = parsed.body;
      }
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const firstIssue = error.issues[0];
        const errorMessage = firstIssue ? firstIssue.message : 'Validation error';
        return next(new AppError(400, errorMessage));
      }
      next(error);
    }
  };
};

export const OrderValidation = {
  createOrderZodSchema,
  updateOrderStatusZodSchema,
  orderQueryZodSchema,
  validateRequest,
};

export default OrderValidation;
