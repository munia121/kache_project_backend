import { Request, Response } from 'express';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import validateUUID from '../../utils/validateUUID';
import ChatService from './chat.service';
import {
  initiateConversationZodSchema,
  sendMessageZodSchema,
} from './chat.validation';

/**
 * Initiate a new conversation or retrieve existing one for a product
 * POST /api/chats/conversations
 */
export const initiateConversation = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const validationResult = initiateConversationZodSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new AppError(
        400,
        validationResult.error.issues[0]?.message || 'Invalid conversation payload'
      );
    }

    const { conversation, isNew } = await ChatService.initiateOrGetConversation(
      userId,
      validationResult.data
    );

    sendResponse(res, {
      statusCode: isNew ? 201 : 200,
      success: true,
      message: isNew
        ? 'Conversation created successfully'
        : 'Existing conversation retrieved successfully',
      data: conversation,
    });
  }
);

/**
 * Fetch all conversations for the authenticated user
 * GET /api/chats/conversations
 */
export const getConversations = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const conversations = await ChatService.getUserConversations(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations,
    });
  }
);

/**
 * Fetch paginated messages for a conversation
 * GET /api/chats/conversations/:id/messages
 */
export const getMessages = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const conversationId = validateUUID(req.params.id, 'Conversation ID');
    const result = await ChatService.getConversationMessages(
      userId,
      conversationId,
      req.query
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Messages retrieved successfully',
      meta: result.meta,
      data: result.messages,
    });
  }
);

/**
 * Mark unread messages sent by the counterpart as read
 * PATCH /api/chats/conversations/:id/read
 */
export const markAsRead = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const conversationId = validateUUID(req.params.id, 'Conversation ID');
    const result = await ChatService.markMessagesAsRead(userId, conversationId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Messages marked as read successfully',
      data: result,
    });
  }
);

/**
 * Send a message via REST endpoint (fallback for Socket.io)
 * POST /api/chats/conversations/:id/messages
 */
export const sendMessage = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Unauthorized');
    }

    const conversationId = validateUUID(req.params.id, 'Conversation ID');
    const validationResult = sendMessageZodSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new AppError(
        400,
        validationResult.error.issues[0]?.message || 'Invalid message payload'
      );
    }

    const message = await ChatService.sendMessageRest(
      userId,
      conversationId,
      validationResult.data.text
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  }
);

export const ChatController = {
  initiateConversation,
  getConversations,
  getMessages,
  markAsRead,
  sendMessage,
};

export default ChatController;
