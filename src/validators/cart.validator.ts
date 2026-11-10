import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';

/**
 * Zod validation schema for adding an item to the cart
 */
export const addToCartSchema = z.object({
  body: z.object({
    productId: z
      .string({ required_error: 'Product ID is required' })
      .uuid({ message: 'Invalid product ID format. Must be a valid UUID' }),
    quantity: z
      .number({ invalid_type_error: 'Quantity must be a number' })
      .int({ message: 'Quantity must be an integer' })
      .min(1, { message: 'Quantity must be at least 1' })
      .default(1)
      .optional(),
  }),
});

/**
 * Zod validation schema for updating a cart item quantity
 */
export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: z
      .number({ required_error: 'Quantity is required' })
      .int({ message: 'Quantity must be an integer' })
      .min(0, { message: 'Quantity cannot be negative' }),
  }),
});

/**
 * Zod schema for a single item in guest cart sync
 */
export const syncCartItemSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid({ message: 'Invalid product ID format. Must be a valid UUID' }),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int({ message: 'Quantity must be an integer' })
    .min(1, { message: 'Quantity must be at least 1' }),
});

/**
 * Zod validation schema for syncing guest localStorage cart to database
 */
export const syncCartSchema = z.object({
  body: z.object({
    items: z.array(syncCartItemSchema, {
      required_error: 'Items array is required for cart sync',
    }),
  }),
});

/**
 * Express middleware to validate request against a Zod schema
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

export const CartValidation = {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
  validateRequest,
};

export default CartValidation;
