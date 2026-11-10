import { Request, Response } from 'express';
import { UserRole, ProductStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import validateUUID from '../../utils/validateUUID';
import ProductService from './product.service';
import { uploadToCloudinary } from '../../config/cloudinary';
import {
  ICreateProductPayload,
  IUpdateProductPayload,
} from './product.interface';
import {
  createProductZodSchema,
  updateProductZodSchema,
} from './product.validation';

/**
 * Get all product listings with filtering, search, and pagination
 * GET /api/products
 */
export const getAllProducts = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const result = await ProductService.getAllProducts(req.query, req.user);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Products retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

/**
 * Get product listing by unique slug
 * GET /api/products/:slug
 */
export const getProductBySlug = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const rawSlug = Array.isArray(req.params.slug)
      ? req.params.slug[0]
      : req.params.slug;

    if (!rawSlug || typeof rawSlug !== 'string' || rawSlug.trim() === '') {
      throw new AppError(400, 'Product slug parameter is required');
    }

    const product = await ProductService.getProductBySlug(rawSlug.trim());

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    });
  }
);


/**
 * Get product listing by UUID
 * GET /api/products/id/:id
 */
export const getProductById = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const id = validateUUID(req.params.id);
    const product = await ProductService.getProductById(id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    });
  }
);

/**
 * Get product listing by UUID or slug
 * GET /api/products/:id or GET /api/products/:slug
 */
export const getSingleProduct = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const rawParam = req.params.id || req.params.slug;
    const identifier = Array.isArray(rawParam) ? rawParam[0] : rawParam;

    if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
      throw new AppError(400, 'Product identifier parameter is required');
    }

    const product = await ProductService.getSingleProduct(identifier.trim());

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    });
  }
);


/**
 * Create a new product listing
 * POST /api/products
 */
/**
 * Helper function to parse multipart/form-data text fields into structured types.
 * Supports individual fields, nested JSON data string, and image array strings.
 */
export const parseProductBody = (
  rawBody: Record<string, unknown>
): Record<string, unknown> => {
  const body: Record<string, unknown> = { ...rawBody };

  // 1. If payload was passed as a JSON string under 'data' key
  if (typeof body.data === 'string' && body.data.trim() !== '') {
    try {
      const parsedData = JSON.parse(body.data);
      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        Object.assign(body, parsedData);
      }
    } catch {
      throw new AppError(400, 'Invalid JSON format in "data" field');
    }
    delete body.data;
  }

  // 2. Parse price to number if provided as string
  if (body.price !== undefined && body.price !== null && body.price !== '') {
    const numPrice = Number(body.price);
    if (isNaN(numPrice)) {
      throw new AppError(400, 'Valid numeric price is required');
    }
    body.price = numPrice;
  }

  // 3. Parse isNegotiable boolean
  if (body.isNegotiable !== undefined) {
    if (typeof body.isNegotiable === 'string') {
      const normalized = body.isNegotiable.trim().toLowerCase();
      body.isNegotiable = normalized === 'true' || normalized === '1';
    } else {
      body.isNegotiable = Boolean(body.isNegotiable);
    }
  }

  // 4. Parse replaceImages boolean flag
  if (body.replaceImages !== undefined) {
    if (typeof body.replaceImages === 'string') {
      const normalized = body.replaceImages.trim().toLowerCase();
      body.replaceImages = normalized === 'true' || normalized === '1';
    } else {
      body.replaceImages = Boolean(body.replaceImages);
    }
  }

  // 5. Parse condition enum
  if (typeof body.condition === 'string') {
    body.condition = body.condition.trim().toUpperCase();
  }

  // 6. Parse status enum
  if (typeof body.status === 'string') {
    body.status = body.status.trim().toUpperCase();
  }

  // 7. Parse categoryId
  if (typeof body.categoryId === 'string') {
    const trimmedCategory = body.categoryId.trim();
    body.categoryId =
      trimmedCategory === '' ||
      trimmedCategory === 'null' ||
      trimmedCategory === 'undefined'
        ? null
        : trimmedCategory;
  }

  // 8. Parse areaId
  if (typeof body.areaId === 'string') {
    const trimmedArea = body.areaId.trim();
    body.areaId =
      trimmedArea === '' ||
      trimmedArea === 'null' ||
      trimmedArea === 'undefined'
        ? null
        : trimmedArea;
  }

  // 9. Parse location
  if (typeof body.location === 'string') {
    const trimmedLocation = body.location.trim();
    body.location =
      trimmedLocation === '' ||
      trimmedLocation === 'null' ||
      trimmedLocation === 'undefined'
        ? null
        : trimmedLocation;
  }

  // 9. Parse images if passed in body (as JSON array, comma-separated, or single string)
  if (typeof body.images === 'string') {
    const trimmedImages = body.images.trim();
    if (trimmedImages === '' || trimmedImages === 'null' || trimmedImages === '[]') {
      body.images = [];
    } else {
      try {
        const parsedImages = JSON.parse(trimmedImages);
        body.images = Array.isArray(parsedImages)
          ? parsedImages.map(String).map((s) => s.trim()).filter(Boolean)
          : [String(parsedImages).trim()];
      } catch {
        if (trimmedImages.includes(',')) {
          body.images = trimmedImages
            .split(',')
            .map((url) => url.trim())
            .filter(Boolean);
        } else {
          body.images = [trimmedImages];
        }
      }
    }
  } else if (Array.isArray(body.images)) {
    body.images = body.images.map(String).map((s) => s.trim()).filter(Boolean);
  }

  return body;
};

/**
 * Safely extracts uploaded files from Express Request
 */
export const getUploadedFiles = (req: Request): Express.Multer.File[] => {
  if (Array.isArray(req.files)) {
    return req.files as Express.Multer.File[];
  }
  if (req.files && typeof req.files === 'object') {
    const values = Object.values(req.files);
    return values.flat() as Express.Multer.File[];
  }
  if (req.file) {
    return [req.file];
  }
  return [];
};

/**
 * Create a new product listing
 * POST /api/products
 */
export const createProduct = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    // Fast-fail AD POSTING GUARD: Block product creation if user.sellerStatus !== "APPROVED" or user.role !== "SELLER"
    if (req.user.sellerStatus !== 'APPROVED' || req.user.role !== 'SELLER') {
      throw new AppError(
        403,
        'Product creation blocked: Only approved sellers can post products. You must have sellerStatus APPROVED and role SELLER.'
      );
    }

    // Parse form-data / JSON body fields
    const parsedBody = parseProductBody(req.body);
    const { title, description, price } = parsedBody;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw new AppError(400, 'Title is required and must be a non-empty string');
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      throw new AppError(400, 'Description is required and must be a non-empty string');
    }

    if (price === undefined || price === null || isNaN(Number(price))) {
      throw new AppError(400, 'Valid numeric price is required');
    }

    if (Number(price) < 0) {
      throw new AppError(400, 'Price must be a non-negative number');
    }

    if (parsedBody.areaId !== undefined && parsedBody.areaId !== null) {
      const areaValidation = createProductZodSchema.shape.areaId.safeParse(parsedBody.areaId);
      if (!areaValidation.success) {
        throw new AppError(400, areaValidation.error.issues[0]?.message || 'Invalid Area ID format');
      }
    }

    // Upload any attached image files to Cloudinary
    const files = getUploadedFiles(req);
    let uploadedUrls: string[] = [];

    if (files.length > 0) {
      uploadedUrls = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, 'kache/products'))
      );
    }

    // Merge any existing image URLs specified in request body with newly uploaded Cloudinary URLs
    const initialImages = Array.isArray(parsedBody.images)
      ? (parsedBody.images as string[])
      : [];
    const finalImages = [...initialImages, ...uploadedUrls];

    const createPayload: ICreateProductPayload = {
      ...(parsedBody as unknown as ICreateProductPayload),
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      images: finalImages,
    };
    delete createPayload.replaceImages;

    const product = await ProductService.createProduct(req.user.id, createPayload);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Product listing created successfully',
      data: product,
    });
  }
);

/**
 * Get listings belonging to the authenticated user
 * GET /api/products/user/my-listings
 */
export const getMyProducts = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const result = await ProductService.getMyProducts(req.user.id, req.query);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User product listings retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

/**
 * Update an existing product listing
 * Ownership Guard: product.sellerId === req.user.id or ADMIN/SUPER_ADMIN
 * PATCH /api/products/:id
 */
export const updateProduct = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const id = validateUUID(req.params.id);
    const existingProduct = await ProductService.getProductById(id);

    const isOwner = existingProduct.sellerId === req.user.id;
    const isAdmin =
      req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw new AppError(
        403,
        'Forbidden: You do not have permission to update this product listing'
      );
    }

    // Parse form-data / JSON body fields
    const parsedBody = parseProductBody(req.body);

    if (parsedBody.title !== undefined) {
      if (typeof parsedBody.title !== 'string' || parsedBody.title.trim() === '') {
        throw new AppError(400, 'Title must be a non-empty string');
      }
    }

    if (parsedBody.description !== undefined) {
      if (
        typeof parsedBody.description !== 'string' ||
        parsedBody.description.trim() === ''
      ) {
        throw new AppError(400, 'Description must be a non-empty string');
      }
    }

    if (parsedBody.price !== undefined) {
      if (isNaN(Number(parsedBody.price)) || Number(parsedBody.price) < 0) {
        throw new AppError(400, 'Price must be a non-negative number');
      }
    }

    if (parsedBody.areaId !== undefined && parsedBody.areaId !== null) {
      const areaValidation = updateProductZodSchema.shape.areaId.safeParse(parsedBody.areaId);
      if (!areaValidation.success) {
        throw new AppError(400, areaValidation.error.issues[0]?.message || 'Invalid Area ID format');
      }
    }

    // Upload any newly uploaded files to Cloudinary
    const files = getUploadedFiles(req);
    let newUploadedUrls: string[] = [];

    if (files.length > 0) {
      newUploadedUrls = await Promise.all(
        files.map((file) => uploadToCloudinary(file.buffer, 'kache/products'))
      );
    }

    const replaceImages = parsedBody.replaceImages === true;
    let finalImages: string[] | undefined = undefined;

    if (replaceImages) {
      // Replace mode: newly uploaded files + body images completely replace previous images
      const bodyImages = Array.isArray(parsedBody.images)
        ? (parsedBody.images as string[])
        : [];
      finalImages = [...bodyImages, ...newUploadedUrls];
    } else {
      // Append mode: if new files or body images are provided, combine them with existing images
      if (newUploadedUrls.length > 0 || parsedBody.images !== undefined) {
        const baseImages = Array.isArray(parsedBody.images)
          ? (parsedBody.images as string[])
          : (existingProduct.images || []);
        finalImages = [...baseImages, ...newUploadedUrls];
      }
    }

    const updatePayload: IUpdateProductPayload = {
      ...(parsedBody as unknown as IUpdateProductPayload),
      ...(finalImages !== undefined && { images: finalImages }),
    };
    delete updatePayload.replaceImages;

    const updatedProduct = await ProductService.updateProduct(id, updatePayload);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Product listing updated successfully',
      data: updatedProduct,
    });
  }
);

/**
 * Remove or archive product listing
 * Ownership Guard: product.sellerId === req.user.id or ADMIN/SUPER_ADMIN
 * DELETE /api/products/:id
 */
export const deleteProduct = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const id = validateUUID(req.params.id);
    const existingProduct = await ProductService.getProductById(id);

    const isOwner = existingProduct.sellerId === req.user.id;
    const isAdmin =
      req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN;

    if (!isOwner && !isAdmin) {
      throw new AppError(
        403,
        'Forbidden: You do not have permission to delete this product listing'
      );
    }

    const permanent = req.query.permanent === 'true';
    const deletedProduct = await ProductService.deleteProduct(id, permanent);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: permanent
        ? 'Product listing deleted permanently'
        : 'Product listing archived successfully',
      data: deletedProduct,
    });
  }
);

/**
 * Update product listing status (AVAILABLE / SOLD)
 * Ownership Guard: product.sellerId === req.user.id or ADMIN/SUPER_ADMIN
 * PATCH /api/products/:id/status
 */
export const updateProductStatus = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const id = validateUUID(req.params.id);

    const { status } = req.body;
    if (!status || typeof status !== 'string' || status.trim() === '') {
      throw new AppError(400, 'Product status is required (e.g. "AVAILABLE" or "SOLD")');
    }

    const upperStatus = status.trim().toUpperCase() as ProductStatus;
    if (!Object.values(ProductStatus).includes(upperStatus)) {
      throw new AppError(
        400,
        `Invalid status '${status}'. Allowed statuses are: ${Object.values(ProductStatus).join(', ')}`
      );
    }

    const updatedProduct = await ProductService.updateProductStatus(
      id,
      req.user.id,
      req.user.role,
      upperStatus
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Product status updated successfully',
      data: updatedProduct,
    });
  }
);

/**
 * Toggle favorite / wishlist status for a product
 * POST /api/products/:id/favorite
 */
export const toggleFavorite = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const id = validateUUID(req.params.id);
    const result = await ProductService.toggleFavorite(req.user.id, id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: result.isFavorited
        ? 'Product added to favorites successfully'
        : 'Product removed from favorites successfully',
      data: result,
    });
  }
);

/**
 * Get favorite products of the authenticated user with pagination
 * GET /api/products/user/my-favorites
 */
export const getMyFavorites = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized access: user identity not verified');
    }

    const result = await ProductService.getMyFavorites(req.user.id, req.query);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User favorite products retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  }
);

export const ProductController = {
  getAllProducts,
  getProductBySlug,
  getProductById,
  getSingleProduct,
  createProduct,
  getMyProducts,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  toggleFavorite,
  getMyFavorites,
};

export default ProductController;
