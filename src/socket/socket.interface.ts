import { Socket } from 'socket.io';
import { IAuthUser } from '../types/express';

export interface AuthenticatedSocket extends Socket {
  user?: IAuthUser;
}

export interface ISendMessagePayload {
  conversationId: string;
  text: string;
}

export interface ITypingPayload {
  conversationId: string;
}
