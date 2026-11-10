import prisma from '../config/prismaClient';
import AppError from '../errors/AppError';

export interface ICartItemResponse {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
  isAvailable: boolean;
  inStock: boolean;
  availableStock: number;
  product: {
    id: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    images: string[];
    condition: string;
    status: string;
    stock: number;
    sellerId: string;
    seller?: {
      id: string;
      fullName: string;
      phone: string;
      shopName?: string | null;
      avatar?: string | null;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ICartSummary {
  totalItems: number; // Distinct products count
  totalQuantity: number; // Total item units count
  subtotal: number; // Subtotal calculated dynamically from DB product prices
  totalAmount: number; // Total payable amount calculated dynamically from DB product prices
}

export interface ICartResponse {
  id: string;
  userId: string;
  items: ICartItemResponse[];
  summary: ICartSummary;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Format raw Prisma cart with items into a secure, computed API response
 * All prices and totals are dynamically calculated from the Product model
 */
const formatCartResponse = (cart: any): ICartResponse => {
  let subtotal = 0;
  let totalQuantity = 0;

  const items: ICartItemResponse[] = (cart.items || []).map((item: any) => {
    const product = item.product;
    // ALWAYS read price directly from database Product model
    const unitPrice = Number(product.price);
    const quantity = item.quantity;
    const itemSubtotal = Number((unitPrice * quantity).toFixed(2));

    // Availability & stock verification
    const isAvailable =
      product.status === 'ACTIVE' || product.status === 'AVAILABLE';

    const inStock = product.stock > 0 && quantity <= product.stock;

    subtotal += itemSubtotal;
    totalQuantity += quantity;

    return {
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity,
      unitPrice,
      itemSubtotal,
      isAvailable,
      inStock,
      availableStock: product.stock,
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: unitPrice,
        images: product.images || [],
        condition: product.condition,
        status: product.status,
        stock: product.stock,
        sellerId: product.sellerId,
        seller: product.seller
          ? {
              id: product.seller.id,
              fullName: product.seller.fullName,
              phone: product.seller.phone,
              shopName: product.seller.shopName || null,
              avatar: product.seller.avatar || null,
            }
          : undefined,
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  const roundedSubtotal = Number(subtotal.toFixed(2));

  return {
    id: cart.id,
    userId: cart.userId,
    items,
    summary: {
      totalItems: items.length,
      totalQuantity,
      subtotal: roundedSubtotal,
      totalAmount: roundedSubtotal,
    },
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
};

/**
 * Include clause for fetching Cart with all relations
 */
const cartIncludeRelations = {
  items: {
    include: {
      product: {
        include: {
          seller: {
            select: {
              id: true,
              fullName: true,
              shopName: true,
              phone: true,
              avatar: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

/**
 * Helper to get or create a Cart for a given user
 */
export const getOrCreateCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: cartIncludeRelations,
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: cartIncludeRelations,
    });
  }

  return cart;
};

/**
 * Get the current user's cart with calculated dynamic totals
 */
export const getCart = async (userId: string): Promise<ICartResponse> => {
  const cart = await getOrCreateCart(userId);
  return formatCartResponse(cart);
};

/**
 * Add a product to the user's cart
 * Enforces:
 * 1. Price is strictly fetched from DB (client price ignored)
 * 2. Self-purchase prevention: product.sellerId === userId -> 400 Bad Request
 * 3. Stock & Status check: Only active/available and unsold (stock > 0) -> 400 Bad Request
 */
export const addToCart = async (
  userId: string,
  payload: { productId: string; quantity?: number }
): Promise<ICartResponse> => {
  const { productId } = payload;
  const quantityToAdd = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;

  // 1. Fetch product directly from database
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, 'Product not found');
  }

  // 2. SELF-PURCHASE PREVENTION (Rule 2)
  if (product.sellerId === userId) {
    throw new AppError(
      400,
      'Self-purchase prevention: You cannot add your own product/listing to the cart'
    );
  }

  // 3. STOCK & STATUS CHECK (Rule 3)
  const isAvailable =
    product.status === 'ACTIVE' || product.status === 'AVAILABLE';

  if (!isAvailable) {
    throw new AppError(
      400,
      `Product '${product.title}' is not active or available for purchase (Status: ${product.status})`
    );
  }

  if (product.stock <= 0) {
    throw new AppError(400, `Product '${product.title}' is out of stock`);
  }

  // 4. Retrieve or initialize user's cart
  const cart = await getOrCreateCart(userId);

  // 5. Check if the product already exists in user's cart
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: product.id,
      },
    },
  });

  const combinedQuantity = (existingItem ? existingItem.quantity : 0) + quantityToAdd;

  if (combinedQuantity > product.stock) {
    throw new AppError(
      400,
      `Insufficient stock for '${product.title}'. Maximum available stock is ${product.stock}, but your cart would total ${combinedQuantity}.`
    );
  }

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: combinedQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: combinedQuantity,
      },
    });
  }

  // 6. Fetch and return fresh cart
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: cartIncludeRelations,
  });

  return formatCartResponse(updatedCart);
};

/**
 * Update the quantity of an item in the cart
 * Quantity 0 deletes the item
 */
export const updateCartItemQuantity = async (
  userId: string,
  itemIdOrProductId: string,
  quantity: number
): Promise<ICartResponse> => {
  const cart = await getOrCreateCart(userId);

  // Find the cart item belonging to this user's cart
  const cartItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      OR: [{ id: itemIdOrProductId }, { productId: itemIdOrProductId }],
    },
    include: {
      product: true,
    },
  });

  if (!cartItem) {
    throw new AppError(404, 'Cart item not found in your cart');
  }

  // If quantity is 0 or negative, remove from cart
  if (quantity <= 0) {
    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: cartIncludeRelations,
    });
    return formatCartResponse(updatedCart);
  }

  // Status & Stock validation
  const product = cartItem.product;
  const isAvailable =
    product.status === 'ACTIVE' || product.status === 'AVAILABLE';

  if (!isAvailable) {
    throw new AppError(
      400,
      `Product '${product.title}' is not active or available for purchase (Status: ${product.status})`
    );
  }

  if (quantity > product.stock) {
    throw new AppError(
      400,
      `Insufficient stock for '${product.title}'. Only ${product.stock} available in stock.`
    );
  }

  // Update quantity
  await prisma.cartItem.update({
    where: { id: cartItem.id },
    data: { quantity },
  });

  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: cartIncludeRelations,
  });

  return formatCartResponse(updatedCart);
};

/**
 * Remove an item from the user's cart
 */
export const removeFromCart = async (
  userId: string,
  itemIdOrProductId: string
): Promise<ICartResponse> => {
  const cart = await getOrCreateCart(userId);

  const cartItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      OR: [{ id: itemIdOrProductId }, { productId: itemIdOrProductId }],
    },
  });

  if (!cartItem) {
    throw new AppError(404, 'Cart item not found in your cart');
  }

  await prisma.cartItem.delete({
    where: { id: cartItem.id },
  });

  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: cartIncludeRelations,
  });

  return formatCartResponse(updatedCart);
};

/**
 * Clear all items in the user's cart
 */
export const clearCart = async (userId: string): Promise<ICartResponse> => {
  const cart = await getOrCreateCart(userId);

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: cartIncludeRelations,
  });

  return formatCartResponse(updatedCart);
};

/**
 * GUEST CART SYNC (Rule 4):
 * Batch merges guest localStorage items into authenticated user's DB cart.
 * All prices are fetched directly from database.
 * Enforces self-purchase prevention & stock/status validations.
 */
export const syncGuestCart = async (
  userId: string,
  guestItems: Array<{ productId: string; quantity: number }>
): Promise<ICartResponse> => {
  if (!guestItems || !Array.isArray(guestItems) || guestItems.length === 0) {
    return getCart(userId);
  }

  // 1. Consolidate any duplicate guest items by productId
  const consolidatedMap = new Map<string, number>();
  for (const item of guestItems) {
    const currentQty = consolidatedMap.get(item.productId) || 0;
    consolidatedMap.set(item.productId, currentQty + item.quantity);
  }

  const consolidatedItems = Array.from(consolidatedMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  // 2. Fetch all products from DB in one batch
  const productIds = consolidatedItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  // 3. Validate every item before execution
  for (const item of consolidatedItems) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new AppError(404, `Product with ID '${item.productId}' not found`);
    }

    // Business Rule 2: Self-Purchase Prevention
    if (product.sellerId === userId) {
      throw new AppError(
        400,
        `Self-purchase prevention: You cannot add your own product '${product.title}' to the cart`
      );
    }

    // Business Rule 3: Stock & Status Check
    const isAvailable =
      product.status === 'ACTIVE' || product.status === 'AVAILABLE';

    if (!isAvailable) {
      throw new AppError(
        400,
        `Product '${product.title}' is not active or available for purchase (Status: ${product.status})`
      );
    }

    if (product.stock <= 0) {
      throw new AppError(400, `Product '${product.title}' is out of stock`);
    }
  }

  // 4. Batch merge into database within a transaction
  return await prisma.$transaction(async (tx) => {
    let cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await tx.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    const existingItemsMap = new Map(cart.items.map((item) => [item.productId, item]));

    for (const item of consolidatedItems) {
      const product = productMap.get(item.productId)!;
      const existing = existingItemsMap.get(item.productId);
      const combinedQuantity = (existing ? existing.quantity : 0) + item.quantity;

      if (combinedQuantity > product.stock) {
        throw new AppError(
          400,
          `Insufficient stock for '${product.title}'. Only ${product.stock} available, but merged cart requires ${combinedQuantity}.`
        );
      }

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: combinedQuantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: product.id,
            quantity: combinedQuantity,
          },
        });
      }
    }

    // 5. Fetch and return formatted cart
    const updatedCart = await tx.cart.findUnique({
      where: { id: cart.id },
      include: cartIncludeRelations,
    });

    return formatCartResponse(updatedCart);
  });
};

export const CartService = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  syncGuestCart,
};

export default CartService;
