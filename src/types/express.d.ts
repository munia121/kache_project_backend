import { UserRole, SellerStatus } from '@prisma/client';

export interface IAuthUser {
  id: string;
  phone: string;
  role: UserRole | string;
  email?: string | null;
  sellerStatus?: SellerStatus | string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}
