import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus, SellerStatus, ProductCondition, ProductStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const connectionString = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const DEFAULT_SEED_PASSWORD = 'Password123@';

export interface IUserSeedItem {
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  sellerStatus?: SellerStatus;
  isEmailVerified: boolean;
  shopName?: string;
  bio?: string;
  area?: string;
  address?: string;
}

export interface IProductSeedItem {
  title: string;
  slug: string;
  description: string;
  price: number;
  isNegotiable: boolean;
  condition: ProductCondition;
  status: ProductStatus;
  images: string[];
  location: string;
  viewsCount: number;
  categorySlug: string;
  sellerEmail: string;
}

export const initialUsers: IUserSeedItem[] = [
  {
    fullName: 'Super Administrator',
    phone: '01700000000',
    email: 'superadmin@kache.com',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    bio: 'Platform Super Administrator with complete system access.',
    area: 'Dhanmondi',
    address: 'House 1, Road 27, Dhanmondi, Dhaka',
  },
  {
    fullName: 'System Admin',
    phone: '01700000001',
    email: 'admin@kache.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    bio: 'Platform Administrator managing listings and users.',
    area: 'Dhanmondi',
    address: 'House 5, Road 8/A, Dhanmondi, Dhaka',
  },
  {
    fullName: 'Rahim Electronics',
    phone: '01700000002',
    email: 'seller@kache.com',
    role: UserRole.SELLER,
    status: UserStatus.ACTIVE,
    sellerStatus: SellerStatus.APPROVED,
    isEmailVerified: true,
    shopName: 'Rahim Gadget Point',
    bio: 'Authentic smartphones, laptops, and gadgets retailer in Dhaka.',
    area: 'Dhanmondi',
    address: 'Shop 104, Plaza AR, Sobhanbag, Dhanmondi, Dhaka',
  },
  {
    fullName: 'Karim Ahmed (Buyer)',
    phone: '01700000003',
    email: 'buyer@kache.com',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    bio: 'Verified buyer and tech enthusiast.',
    area: 'Dhanmondi',
    address: 'Road 4/A, Dhanmondi, Dhaka',
  },
];

export const initialProducts: IProductSeedItem[] = [
  {
    title: 'iPhone 15 Pro 128GB Blue Titanium',
    slug: 'iphone-15-pro-128gb-blue-titanium',
    description: 'iPhone 15 Pro 128GB in pristine Blue Titanium finish. Battery health 96%. All original box, braided USB-C cable, and purchase invoice available. No scratches or dents.',
    price: 118000,
    isNegotiable: true,
    condition: ProductCondition.USED,
    status: ProductStatus.AVAILABLE,
    images: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80',
    ],
    location: 'Dhanmondi 27, Dhaka',
    viewsCount: 142,
    categorySlug: 'mobiles-gadgets',
    sellerEmail: 'seller@kache.com',
  },
  {
    title: 'MacBook Pro M2 14-inch (16GB RAM, 512GB SSD)',
    slug: 'macbook-pro-m2-14-inch-16gb-512gb',
    description: 'Apple MacBook Pro 14-inch with M2 Pro chip, 16GB unified memory, and 512GB SSD. Space Gray. Battery cycle count: 48. Perfect for software development and 4K editing.',
    price: 175000,
    isNegotiable: false,
    condition: ProductCondition.USED,
    status: ProductStatus.AVAILABLE,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    ],
    location: 'Dhanmondi 32, Dhaka',
    viewsCount: 89,
    categorySlug: 'electronics',
    sellerEmail: 'seller@kache.com',
  },
  {
    title: 'Yamaha FZS V3 Deluxe (Dual ABS) 2023',
    slug: 'yamaha-fzs-v3-deluxe-dual-abs-2023',
    description: 'Yamaha FZS V3 Deluxe Matte Red. Dual-channel ABS version. 9,500 km run. Showroom condition with all digital papers and 2-year tax token up to date.',
    price: 245000,
    isNegotiable: true,
    condition: ProductCondition.USED,
    status: ProductStatus.AVAILABLE,
    images: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    ],
    location: 'Mirpur Road, Dhanmondi, Dhaka',
    viewsCount: 210,
    categorySlug: 'vehicles',
    sellerEmail: 'seller@kache.com',
  },
  {
    title: 'Handcrafted Solid Teak Wood Queen Size Bed',
    slug: 'handcrafted-solid-teak-wood-queen-size-bed',
    description: 'Premium Chittagong Segun (Teak) wood queen size bed (5 ft x 7 ft). Includes high-density orthopedic mattress. Termite-proof, natural lacquer finish.',
    price: 38000,
    isNegotiable: true,
    condition: ProductCondition.NEW,
    status: ProductStatus.AVAILABLE,
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    ],
    location: 'Dhanmondi, Dhaka',
    viewsCount: 56,
    categorySlug: 'furniture',
    sellerEmail: 'seller@kache.com',
  },
  {
    title: 'Luxury 3-BHK Apartment for Rent in Dhanmondi',
    slug: 'luxury-3-bhk-apartment-for-rent-dhanmondi',
    description: '1,850 sqft modern apartment on 5th floor. 3 beds, 3 baths, 2 balconies, elevator, generator backup, 24/7 security, and dedicated covered car parking.',
    price: 55000,
    isNegotiable: false,
    condition: ProductCondition.NEW,
    status: ProductStatus.AVAILABLE,
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    ],
    location: 'Road 8/A, Dhanmondi, Dhaka',
    viewsCount: 78,
    categorySlug: 'property-rentals',
    sellerEmail: 'seller@kache.com',
  },
  {
    title: "Men's Handcrafted Full Grain Leather Formal Shoes",
    slug: 'mens-handcrafted-full-grain-leather-formal-shoes',
    description: 'Full-grain cowhide leather formal derby shoes in classic black. Cushioned insole for all-day comfort. Available in size 42.',
    price: 4200,
    isNegotiable: false,
    condition: ProductCondition.NEW,
    status: ProductStatus.AVAILABLE,
    images: [
      'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=80',
    ],
    location: 'Dhanmondi, Dhaka',
    viewsCount: 33,
    categorySlug: 'fashion',
    sellerEmail: 'seller@kache.com',
  },
];

export async function seedUsers(): Promise<Record<string, string>> {
  console.log('\n👥 Starting User seeding...');
  const hashedPassword = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);
  const dhanmondiArea = await prisma.area.findFirst({
    where: { slug: 'dhanmondi' },
  });

  const userIdMap: Record<string, string> = {};

  for (const user of initialUsers) {
    const upsertedUser = await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        fullName: user.fullName,
        email: user.email,
        passwordHash: hashedPassword,
        role: user.role,
        status: user.status,
        sellerStatus: user.sellerStatus ?? SellerStatus.NONE,
        isEmailVerified: user.isEmailVerified,
        shopName: user.shopName,
        bio: user.bio,
        area: user.area,
        areaId: dhanmondiArea?.id || null,
        address: user.address,
      },
      create: {
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        passwordHash: hashedPassword,
        role: user.role,
        status: user.status,
        sellerStatus: user.sellerStatus ?? SellerStatus.NONE,
        isEmailVerified: user.isEmailVerified,
        shopName: user.shopName,
        bio: user.bio,
        area: user.area,
        areaId: dhanmondiArea?.id || null,
        address: user.address,
      },
    });

    userIdMap[user.email] = upsertedUser.id;
    console.log(
      `✅ Upserted User: [${upsertedUser.role}] ${upsertedUser.fullName} (Email: ${upsertedUser.email}, Phone: ${upsertedUser.phone})`
    );
  }

  console.log('✨ Users seeded successfully!');
  return userIdMap;
}

export async function seedProducts(userIdMap: Record<string, string>): Promise<void> {
  console.log('\n📦 Starting Product seeding...');

  const dhanmondiArea = await prisma.area.findFirst({
    where: { slug: 'dhanmondi' },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.slug, cat.id);
  }

  for (const product of initialProducts) {
    const sellerId = userIdMap[product.sellerEmail];
    if (!sellerId) {
      console.warn(`⚠️ Seller with email '${product.sellerEmail}' not found. Skipping product '${product.title}'.`);
      continue;
    }

    const categoryId = categoryMap.get(product.categorySlug) || null;

    const upsertedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        title: product.title,
        description: product.description,
        price: product.price,
        isNegotiable: product.isNegotiable,
        condition: product.condition,
        status: product.status,
        images: product.images,
        location: product.location,
        viewsCount: product.viewsCount,
        sellerId: sellerId,
        categoryId: categoryId,
        areaId: dhanmondiArea?.id || null,
      },
      create: {
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: product.price,
        isNegotiable: product.isNegotiable,
        condition: product.condition,
        status: product.status,
        images: product.images,
        location: product.location,
        viewsCount: product.viewsCount,
        sellerId: sellerId,
        categoryId: categoryId,
        areaId: dhanmondiArea?.id || null,
      },
    });

    console.log(
      `✅ Upserted Product: [${upsertedProduct.slug}] -> ${upsertedProduct.title} (Price: ৳${upsertedProduct.price})`
    );
  }

  console.log('✨ Products seeded successfully!\n');
}

async function main(): Promise<void> {
  try {
    const userIdMap = await seedUsers();
    await seedProducts(userIdMap);
    console.log('🎉 User and Product seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during user & product seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module || process.argv[1]?.includes('seed-users')) {
  main();
}
