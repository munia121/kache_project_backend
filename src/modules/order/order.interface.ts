import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

export type IOrder = Order;
export type IOrderItem = OrderItem;
export { OrderStatus, PaymentMethod, PaymentStatus };
export type IOrderCreate = Prisma.OrderCreateInput;
export type IOrderUpdate = Prisma.OrderUpdateInput;

export interface ICheckoutItem {
  productId: string;
  quantity: number;
}

export interface ICreateOrderPayload {
  shippingAddress: string;
  paymentMethod?: PaymentMethod | 'COD';
  items?: ICheckoutItem[];
}

export interface IUpdateOrderStatusPayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export interface IOrderFilterQuery {
  page?: number | string;
  limit?: number | string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  sortBy?: 'createdAt' | 'totalAmount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  userId?: string;
}

export interface IOrderQueryResult {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: any[];
}
