import { Product, ProductCondition, ProductStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../../config/prismaClient';
import AppError from '../../errors/AppError';
import { UUID_REGEX } from '../../utils/validateUUID';
import {
  ICreateProductPayload,
  IUpdateProductPayload,
  IProductFilterOptions,
  IProductQueryResult,
  IProductWithRelations,
  IToggleFavoriteResult,
  IFavoriteProductFilterOptions,
} from './product.interface';

/**
 * Utility function to generate a URL-friendly slug supporting both English and Bengali characters
 */
export const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0980-\u09FF-]/g, '') // preserves Bengali characters and alphanumeric
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Ensures generated slug is unique in the products table by appending an incremental counter
 */
export const getUniqueProductSlug = async (
  baseText: string,
  currentProductId?: string
): Promise<string> => {
  const baseSlug = generateSlug(baseText) || `product-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug },
    });

    if (!existing || (currentProductId && existing.id === currentProductId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

/**
 * Create a new product listing
 */
export const createProduct = async (
  sellerId: string,
  payload: ICreateProductPayload
): Promise<Product> => {
  // Secondary safety check: verify seller.role !== 'USER' before creating product record
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, role: true },
  });

  if (!seller) {
    throw new AppError(404, 'Seller user not found');
  }

  if (seller.role === UserRole.USER || (seller.role as string) === 'USER') {
    throw new AppError(
      403,
      'Regular users cannot post products. You must complete seller onboarding first to post ads.'
    );
  }

  if (payload.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId },
    });
    if (!category) {
      throw new AppError(404, `Category with id '${payload.categoryId}' not found`);
    }
  }

  if (payload.areaId) {
    const area = await prisma.area.findUnique({
      where: { id: payload.areaId },
    });
    if (!area) {
      throw new AppError(404, `Area with id '${payload.areaId}' not found`);
    }
  }

  const priceDecimal = new Prisma.Decimal(payload.price);
  if (priceDecimal.isNegative()) {
    throw new AppError(400, 'Price must be a non-negative number');
  }

  const slug = await getUniqueProductSlug(payload.title);

  const product = await prisma.product.create({
    data: {
      title: payload.title.trim(),
      slug,
      description: payload.description.trim(),
      price: priceDecimal,
      isNegotiable: payload.isNegotiable ?? false,
      condition: payload.condition ?? ProductCondition.USED,
      status: payload.status ?? ProductStatus.AVAILABLE,
      images: payload.images ?? [],
      location: payload.location ? payload.location.trim() : null,
      sellerId,
      categoryId: payload.categoryId || null,
      areaId: payload.areaId || null,
    },
    include: {
      seller: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          avatar: true,
          area: true,
        },
      },
      category: true,
      area: {
        include: {
          district: {
            include: {
              division: true,
            },
          },
        },
      },
    },
  });

  return product;
};

/**
 * Get all products with advanced search, multi-field filtering, dynamic sorting, and pagination
 */
export const getAllProducts = async (
  filters: IProductFilterOptions = {},
  currentUser?: { id?: string; role?: UserRole | string }
): Promise<IProductQueryResult<IProductWithRelations>> => {
  // 1. Standardized Pagination (default: page 1, limit 10, max cap: 50)
  const page = Math.max(1, parseInt(String(filters.page || 1), 10) || 1);
  const parsedLimit = parseInt(String(filters.limit || 10), 10) || 10;
  const limit = Math.max(1, Math.min(50, parsedLimit));
  const skip = (page - 1) * limit;

  // 2. Dynamic AND conditions array
  const andConditions: Prisma.ProductWhereInput[] = [];

  // Search across title, description, category, and area (case-insensitive) with Bengali/English term mapping
  const searchTerm = (filters.searchTerm || filters.search)?.toString().trim();
  if (searchTerm) {
    const rawTerm = searchTerm.toLowerCase();

    // Map common Bengali & English synonyms
    const synonymsMap: Record<string, string[]> = {
      স্যামসাং: ['samsung', 'galaxy'],
      samsung: ['স্যামসাং', 'galaxy'],
      galaxy: ['স্যামসাং', 'samsung'],
      মোবাইল: ['mobile', 'phone', 'gadget', 'handset', 'smartphone', 'samsung', 'oppo'],
      ফোন: ['phone', 'mobile', 'handset', 'smartphone', 'oppo', 'samsung'],
      phone: ['ফোন', 'mobile', 'smartphone'],
      mobile: ['মোবাইল', 'phone', 'gadget', 'smartphone'],
      mobiles: ['মোবাইল', 'phone', 'gadget', 'smartphone'],
      gadget: ['গ্যাজেট', 'gadgets', 'mobile'],
      gadgets: ['গ্যাজেট', 'gadget', 'mobile'],
      smartphone: ['স্মার্টফোন', 'phone', 'mobile'],
      smartphones: ['স্মার্টফোন', 'phone', 'mobile'],
      স্মার্টফোন: ['smartphone', 'phone', 'mobile'],
      সোফা: ['sofa', 'couch', 'furniture'],
      sofa: ['সোফা', 'couch', 'furniture'],
      ফার্নিচার: ['furniture', 'sofa', 'table', 'chair', 'bed'],
      furniture: ['ফার্নিচার', 'sofa'],
      ওপ্পো: ['oppo'],
      oppo: ['ওপ্পো'],
      আইফোন: ['iphone', 'apple'],
      iphone: ['আইফোন', 'apple'],
      ল্যাপটপ: ['laptop', 'computer'],
      laptop: ['ল্যাপটপ'],
      কম্পিউটার: ['computer', 'pc'],
      computer: ['কম্পিউটার'],
      গাড়ি: ['car', 'vehicle'],
      বাইক: ['bike', 'motorcycle'],
      পোশাক: ['fashion', 'dress', 'clothes'],
      fashion: ['পোশাক', 'dress'],
      ধানমন্ডি: ['dhanmondi'],
      dhanmondi: ['ধানমন্ডি'],
      বনানী: ['banani'],
      banani: ['বনানী'],
      মিরপুর: ['mirpur'],
      mirpur: ['মিরপুর'],
      গুলশান: ['gulshan'],
      gulshan: ['গুলশান'],
      উত্তরা: ['uttara'],
      uttara: ['উত্তরা'],
      বাড্ডা: ['badda'],
      badda: ['বাড্ডা'],
      মোহাম্মদপুর: ['mohammadpur'],
      mohammadpur: ['মোহাম্মদপুর'],
      মতিঝিল: ['motijheel'],
      motijheel: ['মতিঝিল'],
      ঢাকা: ['dhaka'],
      dhaka: ['ঢাকা'],
    };

    const relatedTerms = synonymsMap[rawTerm] || [];
    const allSearchTerms = Array.from(new Set([searchTerm, ...relatedTerms]));

    const searchOrConditions: Prisma.ProductWhereInput[] = [];

    for (const term of allSearchTerms) {
      searchOrConditions.push(
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
        { category: { slug: { contains: term, mode: 'insensitive' } } },
        { area: { name: { contains: term, mode: 'insensitive' } } },
        { area: { bnName: { contains: term, mode: 'insensitive' } } },
        { area: { slug: { contains: term, mode: 'insensitive' } } }
      );
    }

    andConditions.push({
      OR: searchOrConditions,
    });
  }

  // Price Boundary Filter (minPrice & maxPrice decimal comparison)
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceFilter: Prisma.DecimalFilter = {};
    if (
      filters.minPrice !== undefined &&
      filters.minPrice !== '' &&
      !isNaN(Number(filters.minPrice))
    ) {
      priceFilter.gte = new Prisma.Decimal(Number(filters.minPrice));
    }
    if (
      filters.maxPrice !== undefined &&
      filters.maxPrice !== '' &&
      !isNaN(Number(filters.maxPrice))
    ) {
      priceFilter.lte = new Prisma.Decimal(Number(filters.maxPrice));
    }
    if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) {
      andConditions.push({ price: priceFilter });
    }
  }

  // Condition Filter (ProductCondition enum: NEW, USED, REFURBISHED)
  if (filters.condition) {
    const normalizedCondition = String(filters.condition).toUpperCase().trim();
    if (Object.values(ProductCondition).includes(normalizedCondition as ProductCondition)) {
      andConditions.push({ condition: normalizedCondition as ProductCondition });
    }
  }

  // Negotiable Filter (Boolean true/false)
  if (filters.isNegotiable !== undefined && filters.isNegotiable !== '') {
    if (
      filters.isNegotiable === true ||
      String(filters.isNegotiable).toLowerCase() === 'true'
    ) {
      andConditions.push({ isNegotiable: true });
    } else if (
      filters.isNegotiable === false ||
      String(filters.isNegotiable).toLowerCase() === 'false'
    ) {
      andConditions.push({ isNegotiable: false });
    }
  }

  // Category Filter (categoryId OR relation filter via category.slug)
  const categoryParam = (filters.category || filters.categoryId)?.toString().trim();
  if (categoryParam) {
    if (UUID_REGEX.test(categoryParam)) {
      andConditions.push({
        OR: [
          { categoryId: categoryParam },
          { category: { slug: categoryParam } },
        ],
      });
    } else {
      andConditions.push({
        category: { slug: categoryParam },
      });
    }
  }

  // Location Filter (Case-insensitive partial match)
  if (filters.location && typeof filters.location === 'string' && filters.location.trim() !== '') {
    andConditions.push({
      location: {
        contains: filters.location.trim(),
        mode: 'insensitive',
      },
    });
  }

  // Cascading Location Filter (area -> district -> division by id, slug, or name)
  const areaFilter = (filters.area || (filters as any).areaId)?.toString().trim();
  if (areaFilter) {
    const cleanArea = areaFilter.split(',')[0].trim();
    andConditions.push({
      area: {
        OR: [
          { id: areaFilter },
          { id: cleanArea },
          { slug: areaFilter.toLowerCase() },
          { slug: cleanArea.toLowerCase() },
          { name: { contains: cleanArea, mode: 'insensitive' } },
          { bnName: { contains: cleanArea, mode: 'insensitive' } },
        ],
      },
    });
  } else if (filters.district) {
    andConditions.push({
      area: {
        district: {
          OR: [{ id: filters.district }, { slug: filters.district }],
        },
      },
    });
  } else if (filters.division) {
    andConditions.push({
      area: {
        district: {
          division: {
            OR: [{ id: filters.division }, { slug: filters.division }],
          },
        },
      },
    });
  }

  // Optional sellerId filter
  if (filters.sellerId && typeof filters.sellerId === 'string' && filters.sellerId.trim() !== '') {
    andConditions.push({ sellerId: filters.sellerId.trim() });
  }

  // Status Filter Constraints:
  // Public queries MUST strictly filter by status: 'AVAILABLE'.
  // Never return ARCHIVED or SOLD products to public feeds unless specifically queried by an admin or seller.
  const isAdmin =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.SUPER_ADMIN ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN';

  const isSellerQueryingOwn = Boolean(
    currentUser?.id && filters.sellerId && filters.sellerId === currentUser.id
  );

  if (filters.status && (isAdmin || isSellerQueryingOwn)) {
    if (filters.status !== 'ALL') {
      const upperStatus = String(filters.status).toUpperCase().trim();
      if (Object.values(ProductStatus).includes(upperStatus as ProductStatus)) {
        andConditions.push({ status: upperStatus as ProductStatus });
      } else {
        andConditions.push({ status: ProductStatus.AVAILABLE });
      }
    }
    // When 'ALL', no status condition is appended, returning all statuses for privileged query
  } else {
    // Strictly AVAILABLE for public feeds and unprivileged requests
    andConditions.push({ status: ProductStatus.AVAILABLE });
  }

  // Compose dynamic Prisma ProductWhereInput
  const where: Prisma.ProductWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // Dynamic Sorting (Allowed: createdAt, price, viewsCount. Default: createdAt desc)
  const validSortFields = ['createdAt', 'price', 'viewsCount'];
  const sortBy =
    filters.sortBy && validSortFields.includes(String(filters.sortBy))
      ? String(filters.sortBy)
      : 'createdAt';
  const sortOrder: Prisma.SortOrder =
    String(filters.sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

  // Run findMany and count concurrently using Promise.all for optimal performance
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        seller: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatar: true,
          },
        },
        area: {
          include: {
            district: {
              include: {
                division: true,
              },
            },
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: products,
  };
};

/**
 * Fetch product details by slug and increment viewsCount
 */
export const getProductBySlug = async (slug: string): Promise<Product> => {
  const existingProduct = await prisma.product.findUnique({
    where: { slug },
  });

  if (!existingProduct) {
    throw new AppError(404, `Product with slug '${slug}' not found`);
  }

  const product = await prisma.product.update({
    where: { id: existingProduct.id },
    data: {
      viewsCount: {
        increment: 1,
      },
    },
    include: {
      seller: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          avatar: true,
          area: true,
          address: true,
        },
      },
      category: true,
      area: {
        include: {
          district: {
            include: {
              division: true,
            },
          },
        },
      },
    },
  });

  return product;
};

/**
 * Fetch product details by UUID string
 */
export const getProductById = async (id: string): Promise<Product> => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          avatar: true,
          area: true,
          address: true,
        },
      },
      category: true,
      area: {
        include: {
          district: {
            include: {
              division: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new AppError(404, `Product with id '${id}' not found`);
  }

  return product;
};

/**
 * Fetch a single product by identifier (UUID or slug) with nested area -> district -> division
 */
export const getSingleProduct = async (identifier: string): Promise<Product> => {
  if (UUID_REGEX.test(identifier)) {
    return await getProductById(identifier);
  }
  return await getProductBySlug(identifier);
};

/**
 * Update an existing product listing
 */
export const updateProduct = async (
  id: string,
  payload: IUpdateProductPayload
): Promise<Product> => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new AppError(404, `Product with id '${id}' not found`);
  }

  if (payload.categoryId !== undefined && payload.categoryId !== null) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId },
    });
    if (!category) {
      throw new AppError(404, `Category with id '${payload.categoryId}' not found`);
    }
  }

  if (payload.areaId !== undefined && payload.areaId !== null) {
    const area = await prisma.area.findUnique({
      where: { id: payload.areaId },
    });
    if (!area) {
      throw new AppError(404, `Area with id '${payload.areaId}' not found`);
    }
  }

  let newSlug: string | undefined = undefined;
  if (
    payload.title !== undefined &&
    payload.title.trim() !== '' &&
    payload.title.trim() !== existingProduct.title
  ) {
    newSlug = await getUniqueProductSlug(payload.title.trim(), id);
  }

  let priceDecimal: Prisma.Decimal | undefined = undefined;
  if (payload.price !== undefined) {
    priceDecimal = new Prisma.Decimal(payload.price);
    if (priceDecimal.isNegative()) {
      throw new AppError(400, 'Price must be a non-negative number');
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      ...(payload.title !== undefined && { title: payload.title.trim() }),
      ...(newSlug !== undefined && { slug: newSlug }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(priceDecimal !== undefined && { price: priceDecimal }),
      ...(payload.isNegotiable !== undefined && { isNegotiable: payload.isNegotiable }),
      ...(payload.condition !== undefined && { condition: payload.condition }),
      ...(payload.status !== undefined && { status: payload.status }),
      ...(payload.images !== undefined && { images: payload.images }),
      ...(payload.location !== undefined && {
        location: payload.location ? payload.location.trim() : null,
      }),
      ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
      ...(payload.areaId !== undefined && { areaId: payload.areaId }),
    },
    include: {
      seller: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          avatar: true,
          area: true,
        },
      },
      category: true,
      area: {
        include: {
          district: {
            include: {
              division: true,
            },
          },
        },
      },
    },
  });

  return updatedProduct;
};

/**
 * Remove or archive product listing
 */
export const deleteProduct = async (
  id: string,
  permanent: boolean = false
): Promise<Product> => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new AppError(404, `Product with id '${id}' not found`);
  }

  if (permanent) {
    return await prisma.product.delete({
      where: { id },
    });
  }

  return await prisma.product.update({
    where: { id },
    data: {
      status: ProductStatus.ARCHIVED,
    },
  });
};

/**
 * Fetch listings belonging to the authenticated user
 */
export const getMyProducts = async (
  sellerId: string,
  filters: IProductFilterOptions = {}
): Promise<IProductQueryResult> => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    sellerId,
    ...(filters.status &&
      filters.status !== 'ALL' &&
      Object.values(ProductStatus).includes(String(filters.status).toUpperCase() as ProductStatus) && {
        status: String(filters.status).toUpperCase() as ProductStatus,
      }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: products,
  };
};

/**
 * Update product status (AVAILABLE / SOLD / ARCHIVED)
 * Guard: only seller or ADMIN/SUPER_ADMIN can perform this action
 */
export const updateProductStatus = async (
  id: string,
  userId: string,
  userRole: UserRole | string,
  status: ProductStatus
): Promise<Product> => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new AppError(404, `Product with id '${id}' not found`);
  }

  const isOwner = existingProduct.sellerId === userId;
  const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      403,
      'Forbidden: Only the product seller or an admin can update the status'
    );
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      status,
    },
    include: {
      seller: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          avatar: true,
          area: true,
        },
      },
      category: true,
    },
  });

  return updatedProduct;
};

/**
 * Toggle favorite / wishlist status for a product
 * If previously not favorited, adds to wishlist (isFavorited: true)
 * If previously favorited, removes from wishlist (isFavorited: false)
 */
export const toggleFavorite = async (
  userId: string,
  productId: string
): Promise<IToggleFavoriteResult> => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, `Product with id '${productId}' not found`);
  }

  const existingFavorite = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (existingFavorite) {
    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return {
      isFavorited: false,
      productId,
    };
  }

  await prisma.wishlist.create({
    data: {
      userId,
      productId,
    },
  });

  return {
    isFavorited: true,
    productId,
  };
};

/**
 * Fetch favorite products of the authenticated user with pagination
 */
export const getMyFavorites = async (
  userId: string,
  filters: IFavoriteProductFilterOptions = {}
): Promise<IProductQueryResult> => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.WishlistWhereInput = {
    userId,
  };

  const [wishlistItems, total] = await Promise.all([
    prisma.wishlist.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            seller: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                avatar: true,
                area: true,
              },
            },
            category: true,
          },
        },
      },
    }),
    prisma.wishlist.count({ where }),
  ]);

  const products = wishlistItems.map((item) => ({
    ...item.product,
    wishlistId: item.id,
    favoritedAt: item.createdAt,
  }));

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: products,
  };
};

export const ProductService = {
  generateSlug,
  getUniqueProductSlug,
  createProduct,
  getAllProducts,
  getSingleProduct,
  getProductBySlug,
  getProductById,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  getMyProducts,
  toggleFavorite,
  getMyFavorites,
};

export default ProductService;
