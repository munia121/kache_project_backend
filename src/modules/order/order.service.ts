import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import prisma from '../../config/prismaClient';
import AppError from '../../errors/AppError';
import validateUUID from '../../utils/validateUUID';
import { IAuthUser } from '../../types/express';
import {
  ICreateOrderPayload,
  IUpdateOrderStatusPayload,
  IOrderFilterQuery,
  IOrderQueryResult,
} from './order.interface';

export const orderIncludeRelations = {
  orderItems: {
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          images: true,
          condition: true,
          status: true,
          sellerId: true,
          seller: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              shopName: true,
              avatar: true,
            },
          },
        },
      },
    },
  },
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      address: true,
      area: true,
    },
  },
};

/**
 * Creates a Cash on Delivery (COD) Order.
 * ATOMIC EXECUTION:
 * 1. Validates products, stock, availability, and prevents self-purchase.
 * 2. Creates the Order and OrderItem records.
 * 3. Decrements product stock (and updates status to SOLD if stock reaches 0).
 * 4. Clears purchased items from the buyer's DB Cart.
 * All runs strictly inside prisma.$transaction.
 */
export const createOrder = async (
  userId: string,
  payload: ICreateOrderPayload
) => {
  if (!payload.shippingAddress || payload.shippingAddress.trim().length === 0) {
    throw new AppError(400, 'Shipping address is required');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Determine items to checkout
    let checkoutItems: Array<{ productId: string; quantity: number }> = [];

    if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
      // Consolidate duplicate products in payload
      const itemMap = new Map<string, number>();
      for (const item of payload.items) {
        if (!validateUUID(item.productId)) {
          throw new AppError(400, `Invalid product ID format: '${item.productId}'`);
        }
        if (item.quantity <= 0) {
          throw new AppError(400, `Quantity for product '${item.productId}' must be at least 1`);
        }
        itemMap.set(item.productId, (itemMap.get(item.productId) || 0) + item.quantity);
      }
      checkoutItems = Array.from(itemMap.entries()).map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    } else {
      // Checkout from DB cart
      const userCart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!userCart || !userCart.items || userCart.items.length === 0) {
        throw new AppError(400, 'Your cart is empty. Please add items to cart before checkout.');
      }

      checkoutItems = userCart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
    }

    if (checkoutItems.length === 0) {
      throw new AppError(400, 'No items provided for checkout');
    }

    const productIds = checkoutItems.map((item) => item.productId);

    // 2. Fetch products from DB inside transaction
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = productIds.filter((id) => !foundIds.has(id));
      throw new AppError(404, `Product(s) not found: ${missingIds.join(', ')}`);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Validate stock, availability, and self-purchase prevention
    let totalAmount = new Prisma.Decimal(0);
    const orderItemsData: Array<{
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }> = [];

    for (const item of checkoutItems) {
      const product = productMap.get(item.productId)!;

      // Self-purchase prevention
      if (product.sellerId === userId) {
        throw new AppError(
          400,
          `Self-purchase prevention: You cannot purchase your own product '${product.title}'`
        );
      }

      // Availability check
      const isAvailable =
        product.status === ProductStatus.AVAILABLE || product.status === ProductStatus.ACTIVE;
      if (!isAvailable) {
        throw new AppError(
          400,
          `Product '${product.title}' is not available for purchase (status: ${product.status})`
        );
      }

      // Stock check
      if (product.stock < item.quantity) {
        throw new AppError(
          400,
          `Insufficient stock for '${product.title}'. Available: ${product.stock}, requested: ${item.quantity}`
        );
      }

      // Dynamic price calculation from DB Product record
      const unitPrice = product.price;
      const itemSubtotal = unitPrice.mul(item.quantity);
      totalAmount = totalAmount.add(itemSubtotal);

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
      });
    }

    // 4. Create Order and OrderItems
    const order = await tx.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        totalAmount,
        shippingAddress: payload.shippingAddress.trim(),
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.UNPAID,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: orderIncludeRelations,
    });

    // 5. Decrement product stock atomically
    for (const item of checkoutItems) {
      const product = productMap.get(item.productId)!;
      const remainingStock = product.stock - item.quantity;

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
          ...(remainingStock === 0 ? { status: ProductStatus.SOLD } : {}),
        },
      });
    }

    // 6. Clear purchased items from the buyer's DB Cart
    const userCart = await tx.cart.findUnique({
      where: { userId },
    });

    if (userCart) {
      await tx.cartItem.deleteMany({
        where: {
          cartId: userCart.id,
          productId: { in: productIds },
        },
      });
    }

    return order;
  });
};

/**
 * Get orders belonging to the authenticated user
 */
export const getMyOrders = async (
  userId: string,
  query: IOrderFilterQuery
): Promise<IOrderQueryResult> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
  };

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: orderIncludeRelations,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
    data: orders,
  };
};

/**
 * Get single order details with ownership verification
 */
export const getOrderById = async (orderId: string, currentUser: IAuthUser) => {
  if (!validateUUID(orderId)) {
    throw new AppError(400, 'Invalid order ID format');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderIncludeRelations,
  });

  if (!order) {
    throw new AppError(404, `Order with ID '${orderId}' not found`);
  }

  const isBuyer = order.userId === currentUser.id;
  const isAdmin =
    currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN;
  const isSellerOfItem = order.orderItems.some(
    (item) => item.product?.sellerId === currentUser.id
  );

  if (!isBuyer && !isAdmin && !isSellerOfItem) {
    throw new AppError(403, 'You do not have permission to view this order');
  }

  return order;
};

/**
 * Cancel an order and restore product stock inside a transaction
 */
export const cancelOrder = async (orderId: string, currentUser: IAuthUser) => {
  if (!validateUUID(orderId)) {
    throw new AppError(400, 'Invalid order ID format');
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, `Order with ID '${orderId}' not found`);
    }

    const isBuyer = order.userId === currentUser.id;
    const isAdmin =
      currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN;

    if (!isBuyer && !isAdmin) {
      throw new AppError(403, 'You do not have permission to cancel this order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new AppError(400, 'Order is already cancelled');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new AppError(400, 'Delivered orders cannot be cancelled');
    }

    if (order.status === OrderStatus.SHIPPED && !isAdmin) {
      throw new AppError(
        400,
        'Order has already been shipped. Please contact customer support to request a return or cancellation.'
      );
    }

    // 1. Update order status to CANCELLED
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
      },
      include: orderIncludeRelations,
    });

    // 2. Restore product stock
    for (const item of order.orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
          ...(item.product.status === ProductStatus.SOLD
            ? { status: ProductStatus.AVAILABLE }
            : {}),
        },
      });
    }

    return updatedOrder;
  });
};

/**
 * Update order status (ADMIN or SELLER)
 * Automatically marks PaymentStatus as PAID if status is DELIVERED for COD.
 * Restores stock if transitioning to CANCELLED.
 */
export const updateOrderStatus = async (
  orderId: string,
  payload: IUpdateOrderStatusPayload,
  currentUser: IAuthUser
) => {
  if (!validateUUID(orderId)) {
    throw new AppError(400, 'Invalid order ID format');
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError(404, `Order with ID '${orderId}' not found`);
    }

    const isAdmin =
      currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN;
    const isSellerOfItem = order.orderItems.some(
      (item) => item.product?.sellerId === currentUser.id
    );

    if (!isAdmin && !isSellerOfItem) {
      throw new AppError(403, 'You do not have permission to update this order');
    }

    // If changing to CANCELLED and was not cancelled before, restore stock
    if (payload.status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      for (const item of order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            ...(item.product.status === ProductStatus.SOLD
              ? { status: ProductStatus.AVAILABLE }
              : {}),
          },
        });
      }
    }

    // COD delivery business logic: if marked DELIVERED and COD, payment is received
    let targetPaymentStatus = payload.paymentStatus;
    if (!targetPaymentStatus && payload.status === OrderStatus.DELIVERED) {
      targetPaymentStatus = PaymentStatus.PAID;
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(targetPaymentStatus ? { paymentStatus: targetPaymentStatus } : {}),
      },
      include: orderIncludeRelations,
    });

    return updatedOrder;
  });
};

/**
 * Admin: Get all orders across platform with filters and pagination
 */
export const getAllOrders = async (query: IOrderFilterQuery): Promise<IOrderQueryResult> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.search
      ? {
          OR: [
            { id: { contains: query.search, mode: 'insensitive' } },
            { shippingAddress: { contains: query.search, mode: 'insensitive' } },
            {
              user: {
                OR: [
                  { fullName: { contains: query.search, mode: 'insensitive' } },
                  { phone: { contains: query.search, mode: 'insensitive' } },
                  { email: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: orderIncludeRelations,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
    data: orders,
  };
};

/**
 * Seller: Get orders that contain the seller's products
 */
export const getSellerOrders = async (
  sellerId: string,
  query: IOrderFilterQuery
): Promise<IOrderQueryResult> => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    orderItems: {
      some: {
        product: {
          sellerId,
        },
      },
    },
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
  };

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: orderIncludeRelations,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
    data: orders,
  };
};

export const OrderService = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  getAllOrders,
  getSellerOrders,
};

export default OrderService;
