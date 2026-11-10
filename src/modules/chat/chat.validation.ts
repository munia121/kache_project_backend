import { z } from 'zod';

export const initiateConversationZodSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).uuid({
    message: 'Invalid Product ID format. Must be a valid UUID',
  }),
  sellerId: z
    .string()
    .uuid({ message: 'Invalid Seller ID format. Must be a valid UUID' })
    .optional(),
});

export const sendMessageZodSchema = z.object({
  text: z
    .string({ required_error: 'Message text is required' })
    .min(1, 'Message text cannot be empty')
    .max(5000, 'Message text exceeds 5000 characters limit'),
});

export const ChatValidation = {
  initiateConversationZodSchema,
  sendMessageZodSchema,
};

export default ChatValidation;
