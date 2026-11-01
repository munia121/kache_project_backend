import { User, UserRole, Prisma, Area, District, Division, Product } from '@prisma/client';

export type IUser = User;
export { UserRole, UserRole as Role };
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
