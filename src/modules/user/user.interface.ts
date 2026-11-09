import { User, UserRole, SellerStatus, Prisma, Area, District, Division, Product } from '@prisma/client';

export type IUser = User;
export { UserRole, UserRole as Role, SellerStatus };
export type IUserCreate = Prisma.UserCreateInput;
export type IUserUpdate = Prisma.UserUpdateInput;

/**
 * Nested location hierarchy interface
 */
export interface ILocationAreaHierarchy extends Area {
  district: District & {
    division: Division;
  };
}

/**
 * User profile response excluding sensitive password hash
 */
export type IUserProfileResponse = Omit<User, 'passwordHash'> & {
  locationArea?: ILocationAreaHierarchy | null;
};

/**
 * Payload for becoming a seller
 */
export interface IBecomeSellerPayload {
  termsAccepted: boolean;
  shopName?: string | null;
  bio?: string | null;
}

/**
 * Payload for reviewing seller application (admin)
 */
export interface IReviewSellerApplicationPayload {
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
}

/**
 * Payload for revoking seller privileges (admin)
 */
export interface IRevokeSellerPayload {
  reason?: string;
}

/**
 * Result of revoking seller privileges
 */
export interface IRevokeSellerResult {
  demotedUser: IUserProfileResponse;
  updatedProductsCount: number;
}

/**
 * Filter and pagination options for seller applications (admin)
 */
export interface ISellerApplicationQueryOptions {
  status?: SellerStatus | string;
  page?: number | string;
  limit?: number | string;
  search?: string;
}

/**
 * Paginated seller applications result
 */
export interface ISellerApplicationResult {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: IUserProfileResponse[];
}

/**
 * Payload for updating profile information
 */
export interface IUpdateProfilePayload {
  fullName?: string;
  avatar?: string | null;
  areaId?: string | null;
  address?: string | null;
  role?: UserRole | string;
  shopName?: string | null;
  bio?: string | null;
}

/**
 * Payload for changing user password
 */
export interface IChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

/**
 * Filter options for fetching user's listings
 */
export interface IMyListingsFilterOptions {
  status?: string;
  page?: number | string;
  limit?: number | string;
}

/**
 * Paginated listings result
 */
export interface IMyListingsResult {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: Product[];
}
