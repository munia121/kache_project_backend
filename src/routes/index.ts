import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { UserRoutes } from '../modules/user/user.routes';
import { CategoryRoutes } from '../modules/category/category.routes';
import { ProductRoutes } from '../modules/product/product.routes';
import { LocationRoutes } from '../modules/location/location.routes';
import { ChatRoutes } from '../modules/chat/chat.routes';
import { CartRoutes } from './cart.routes';

const router = Router();

// Module routes will be mounted here
const moduleRoutes: { path: string; route: Router }[] = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/categories',
    route: CategoryRoutes,
  },
  {
    path: '/products',
    route: ProductRoutes,
  },
  {
    path: '/locations',
    route: LocationRoutes,
  },
  {
    path: '/chats',
    route: ChatRoutes,
  },
  {
    path: '/cart',
    route: CartRoutes,
  },
  // {
  //   path: '/orders',
  //   route: orderRoutes,
  // },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
