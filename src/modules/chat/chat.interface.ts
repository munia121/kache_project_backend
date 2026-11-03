export interface IInitiateConversationPayload {
  productId: string;
  sellerId?: string;
}

export interface ISendMessageRestPayload {
  text: string;
}

export interface IConversationQuery {
  page?: string | number;
  limit?: string | number;
  order?: 'asc' | 'desc';
}
