import prisma from '../../config/prismaClient';
import AppError from '../../errors/AppError';
import { getIO } from '../../socket';
import {
  IInitiateConversationPayload,
  IConversationQuery,
} from './chat.interface';

const productSelect = {
  id: true,
  title: true,
  slug: true,
  price: true,
  images: true,
  status: true,
  sellerId: true,
};

const userSelect = {
  id: true,
  fullName: true,
  avatar: true,
  phone: true,
  role: true,
  shopName: true,
};

/**
 * Initiate a new conversation or retrieve an existing one
 */
export const initiateOrGetConversation = async (
  userId: string,
  payload: IInitiateConversationPayload
) => {
  const { productId } = payload;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelect,
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  const sellerId = product.sellerId;

  if (payload.sellerId && payload.sellerId !== sellerId) {
    throw new AppError(
      400,
      'The provided sellerId does not match the product owner'
    );
  }

  // Prevent user from chatting with themselves on their own product
  if (userId === sellerId) {
    throw new AppError(
      400,
      'You cannot initiate a chat conversation for your own product'
    );
  }

  // Check if conversation already exists for this (product, buyer, seller)
  const existingConversation = await prisma.conversation.findUnique({
    where: {
      productId_buyerId_sellerId: {
        productId,
        buyerId: userId,
        sellerId,
      },
    },
    include: {
      product: {
        select: productSelect,
      },
      buyer: {
        select: userSelect,
      },
      seller: {
        select: userSelect,
      },
    },
  });

  if (existingConversation) {
    return {
      conversation: existingConversation,
      isNew: false,
    };
  }

  // Create new conversation
  const newConversation = await prisma.conversation.create({
    data: {
      productId,
      buyerId: userId,
      sellerId,
    },
    include: {
      product: {
        select: productSelect,
      },
      buyer: {
        select: userSelect,
      },
      seller: {
        select: userSelect,
      },
    },
  });

  return {
    conversation: newConversation,
    isNew: true,
  };
};

/**
 * Fetch all conversations for the authenticated user (as buyer or seller)
 */
export const getUserConversations = async (userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
    include: {
      product: {
        select: productSelect,
      },
      buyer: {
        select: userSelect,
      },
      seller: {
        select: userSelect,
      },
      messages: {
        take: 1,
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  // Calculate unread count for each conversation
  const conversationsWithMeta = await Promise.all(
    conversations.map(async (conv) => {
      const isBuyer = conv.buyerId === userId;
      const counterpart = isBuyer ? conv.seller : conv.buyer;

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          isRead: false,
        },
      });

      return {
        id: conv.id,
        productId: conv.productId,
        buyerId: conv.buyerId,
        sellerId: conv.sellerId,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        product: conv.product,
        buyer: conv.buyer,
        seller: conv.seller,
        counterpart,
        unreadCount,
      };
    })
  );

  return conversationsWithMeta;
};

/**
 * Get paginated message history for a conversation
 */
export const getConversationMessages = async (
  userId: string,
  conversationId: string,
  query: IConversationQuery
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
    },
  });

  if (!conversation) {
    throw new AppError(404, 'Conversation not found');
  }

  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    throw new AppError(
      403,
      'Forbidden: You are not a participant in this conversation'
    );
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const order: 'asc' | 'desc' = query.order === 'desc' ? 'desc' : 'asc';

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: order },
      skip,
      take: limit,
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
    }),
    prisma.message.count({
      where: { conversationId },
    }),
  ]);

  return {
    messages,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

/**
 * Mark unread messages sent by the other party as read
 */
export const markMessagesAsRead = async (
  userId: string,
  conversationId: string
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
    },
  });

  if (!conversation) {
    throw new AppError(404, 'Conversation not found');
  }

  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    throw new AppError(
      403,
      'Forbidden: You are not a participant in this conversation'
    );
  }

  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  // Notify socket room that messages have been read
  try {
    const io = getIO();
    io.to(conversationId).emit('messages_read', {
      conversationId,
      readBy: userId,
      count: result.count,
    });
  } catch (error) {
    // Socket might not be initialized during isolated unit test
  }

  return {
    conversationId,
    readCount: result.count,
  };
};

/**
 * REST fallback to send message in a conversation
 */
export const sendMessageRest = async (
  userId: string,
  conversationId: string,
  text: string
) => {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new AppError(400, 'Message text cannot be empty');
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
    },
  });

  if (!conversation) {
    throw new AppError(404, 'Conversation not found');
  }

  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    throw new AppError(
      403,
      'Forbidden: You are not a participant in this conversation'
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      text: cleanText,
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

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: cleanText,
      lastMessageAt: new Date(),
    },
  });

  try {
    const io = getIO();
    io.to(conversationId).emit('receive_message', message);

    const counterpartId =
      conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
    io.to(`user:${counterpartId}`).emit('conversation_updated', {
      conversationId,
      lastMessage: cleanText,
      lastMessageAt: message.createdAt,
      senderId: userId,
    });
  } catch (error) {
    // Socket might not be active
  }

  return message;
};

export const ChatService = {
  initiateOrGetConversation,
  getUserConversations,
  getConversationMessages,
  markMessagesAsRead,
  sendMessageRest,
};

export default ChatService;
