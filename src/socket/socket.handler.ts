import { Server } from 'socket.io';
import prisma from '../config/prismaClient';
import { UUID_REGEX } from '../utils/validateUUID';
import { AuthenticatedSocket, ISendMessagePayload, ITypingPayload } from './socket.interface';

export const registerSocketHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.id;

  if (!userId) {
    socket.disconnect(true);
    return;
  }

  // Join personal user room for direct alerts and push notifications
  socket.join(`user:${userId}`);
  console.log(`🔌 [Socket.IO] User connected: ${userId} (Socket ID: ${socket.id})`);

  /**
   * Event: join_conversation
   * Joins socket room for a specific conversation after authorization check
   */
  socket.on(
    'join_conversation',
    async (
      payload: string | { conversationId: string },
      callback?: (res: { success: boolean; message?: string; conversationId?: string }) => void
    ) => {
      try {
        const conversationId =
          typeof payload === 'string' ? payload.trim() : payload?.conversationId?.trim();

        if (!conversationId || !UUID_REGEX.test(conversationId)) {
          const errMsg = 'Valid conversationId (UUID) is required to join';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { id: true, buyerId: true, sellerId: true },
        });

        if (!conversation) {
          const errMsg = 'Conversation not found';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
          const errMsg = 'Unauthorized: You are not a participant in this conversation';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        await socket.join(conversationId);
        console.log(`💬 User ${userId} joined conversation room: ${conversationId}`);

        if (callback) {
          callback({ success: true, conversationId });
        }
      } catch (err: any) {
        console.error('Error in join_conversation:', err);
        const errMsg = err.message || 'Failed to join conversation';
        socket.emit('error', { message: errMsg });
        if (callback) callback({ success: false, message: errMsg });
      }
    }
  );

  /**
   * Event: send_message
   * Persists message, updates conversation lastMessage/lastMessageAt, and broadcasts to room
   */
  socket.on(
    'send_message',
    async (
      payload: ISendMessagePayload,
      callback?: (res: { success: boolean; data?: any; message?: string }) => void
    ) => {
      try {
        const { conversationId, text } = payload || {};

        if (!conversationId || typeof conversationId !== 'string' || !UUID_REGEX.test(conversationId.trim())) {
          const errMsg = 'Valid conversationId (UUID) is required';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        const trimmedText = typeof text === 'string' ? text.trim() : '';
        if (!trimmedText) {
          const errMsg = 'Message text cannot be empty';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        const cleanConversationId = conversationId.trim();

        const conversation = await prisma.conversation.findUnique({
          where: { id: cleanConversationId },
          select: { id: true, buyerId: true, sellerId: true },
        });

        if (!conversation) {
          const errMsg = 'Conversation does not exist';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
          const errMsg = 'Unauthorized: You are not a participant in this conversation';
          socket.emit('error', { message: errMsg });
          if (callback) callback({ success: false, message: errMsg });
          return;
        }

        // Persist message in database
        const message = await prisma.message.create({
          data: {
            conversationId: cleanConversationId,
            senderId: userId,
            text: trimmedText,
          },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
                role: true,
              },
            },
          },
        });

        // Update conversation summary
        await prisma.conversation.update({
          where: { id: cleanConversationId },
          data: {
            lastMessage: trimmedText,
            lastMessageAt: new Date(),
          },
        });

        // Broadcast to everyone in conversation room (including sender or to other participants)
        io.to(cleanConversationId).emit('receive_message', message);

        // Notify counterpart if they are not active in room
        const counterpartId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
        io.to(`user:${counterpartId}`).emit('conversation_updated', {
          conversationId: cleanConversationId,
          lastMessage: trimmedText,
          lastMessageAt: message.createdAt,
          senderId: userId,
        });

        if (callback) {
          callback({ success: true, data: message });
        }
      } catch (err: any) {
        console.error('Error in send_message:', err);
        const errMsg = err.message || 'Failed to send message';
        socket.emit('error', { message: errMsg });
        if (callback) callback({ success: false, message: errMsg });
      }
    }
  );

  /**
   * Event: typing
   * Broadcasts typing indicator to the conversation room
   */
  socket.on('typing', (payload: ITypingPayload | string) => {
    const conversationId = typeof payload === 'string' ? payload.trim() : payload?.conversationId?.trim();
    if (conversationId) {
      socket.to(conversationId).emit('typing', {
        conversationId,
        userId,
        isTyping: true,
      });
    }
  });

  /**
   * Event: stop_typing
   * Broadcasts stopped typing indicator to the conversation room
   */
  socket.on('stop_typing', (payload: ITypingPayload | string) => {
    const conversationId = typeof payload === 'string' ? payload.trim() : payload?.conversationId?.trim();
    if (conversationId) {
      socket.to(conversationId).emit('stop_typing', {
        conversationId,
        userId,
        isTyping: false,
      });
    }
  });

  /**
   * Event: disconnect
   */
  socket.on('disconnect', (reason) => {
    console.log(`🔌 [Socket.IO] User disconnected: ${userId} (Reason: ${reason})`);
  });
};
