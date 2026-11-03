import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth';
import { ChatController } from './chat.controller';

const router = Router();

// ==========================================
// Real-Time Chat & Conversation Routes
// Base: /api/chats
// ==========================================

/**
 * @route   POST /api/chats/conversations
 * @desc    Initiate or retrieve conversation for { productId, sellerId? }
 * @access  Protected
 */
router.post('/conversations', verifyToken, ChatController.initiateConversation);

/**
 * @route   GET /api/chats/conversations
 * @desc    Fetch all conversations for the authenticated user
 * @access  Protected
 */
router.get('/conversations', verifyToken, ChatController.getConversations);

/**
 * @route   GET /api/chats/conversations/:id/messages
 * @desc    Fetch paginated messages history for a conversation
 * @access  Protected
 */
router.get(
  '/conversations/:id/messages',
  verifyToken,
  ChatController.getMessages
);

/**
 * @route   PATCH /api/chats/conversations/:id/read
 * @desc    Mark unread messages sent by counterpart as read
 * @access  Protected
 */
router.patch('/conversations/:id/read', verifyToken, ChatController.markAsRead);

/**
 * @route   POST /api/chats/conversations/:id/messages
 * @desc    Send a message via REST fallback
 * @access  Protected
 */
router.post(
  '/conversations/:id/messages',
  verifyToken,
  ChatController.sendMessage
);

export const ChatRoutes = router;
export default ChatRoutes;
