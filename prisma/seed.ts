import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus, ProductCondition, ProductStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const connectionString = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ICategorySeedItem {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  order: number;
}

interface IAreaSeedItem {
  name: string;
  bnName: string;
  slug: string;
}

interface IDistrictSeedItem {
  name: string;
  bnName: string;
  slug: string;
  areas: IAreaSeedItem[];
}

interface IDivisionSeedItem {
  name: string;
  bnName: string;
  slug: string;
  districts: IDistrictSeedItem[];
}

const initialCategories: ICategorySeedItem[] = [
  {
    name: 'Mobiles & Gadgets',
    slug: 'mobiles-gadgets',
    icon: 'smartphone',
    description: 'Smartphones, feature phones, tablets, chargers, power banks, and accessories.',
    order: 1,
  },
  {
    name: 'Electronics & Home Appliances',
    slug: 'electronics',
    icon: 'tv',
    description: 'TVs, refrigerators, ACs, washing machines, computers, laptops, and home electronics.',
    order: 2,
  },
  {
    name: 'Vehicles & Bikes',
    slug: 'vehicles',
    icon: 'bike',
    description: 'Motorcycles, scooters, bicycles, cars, and vehicle spare parts.',
    order: 3,
  },
  {
    name: 'Property & Rentals',
    slug: 'property-rentals',
    icon: 'home',
    description: 'Apartments, flats, sublets, bachelor/family home rentals, land, and commercial spaces.',
    order: 4,
  },
  {
    name: 'Fashion & Lifestyle',
    slug: 'fashion',
    icon: 'shirt',
    description: 'Trendy clothing for men, women, and kids, shoes, watches, bags, and lifestyle items.',
    order: 5,
  },
  {
    name: 'Home & Furniture',
    slug: 'furniture',
    icon: 'armchair',
    description: 'Beds, wardrobes, sofas, dining tables, office furniture, and home decor.',
    order: 6,
  },
  {
    name: 'Daily Essentials & Groceries',
    slug: 'essentials',
    icon: 'shopping-cart',
    description: 'Groceries, fresh fruits, vegetables, rice, lentils, oil, and daily essential goods.',
    order: 7,
  },
  {
    name: 'Local Services',
    slug: 'services',
    icon: 'wrench',
    description: 'AC & fridge repair, electricians, plumbers, home cleaning, and other local services.',
    order: 8,
  },
];

const initialLocations: IDivisionSeedItem[] = [
  {
    name: 'Dhaka',
    bnName: 'ঢাকা',
    slug: 'dhaka',
    districts: [
      {
        name: 'Dhaka',
        bnName: 'ঢাকা',
        slug: 'dhaka',
        areas: [
          { name: 'Dhanmondi', bnName: 'ধানমন্ডি', slug: 'dhanmondi' },
          { name: 'Mirpur', bnName: 'মিরপুর', slug: 'mirpur' },
          { name: 'Banani', bnName: 'বনানী', slug: 'banani' },
          { name: 'Uttara', bnName: 'উত্তরা', slug: 'uttara' },
          { name: 'Gulshan', bnName: 'গুলশান', slug: 'gulshan' },
          { name: 'Mohammadpur', bnName: 'মোহাম্মদপুর', slug: 'mohammadpur' },
          { name: 'Badda', bnName: 'বাড্ডা', slug: 'badda' },
          { name: 'Motijheel', bnName: 'মতিঝিল', slug: 'motijheel' },
          { name: 'Old Dhaka', bnName: 'পুরান ঢাকা', slug: 'old-dhaka' },
          { name: 'Bashundhara R/A', bnName: 'বসুন্ধরা আবাসিক এলাকা', slug: 'bashundhara-ra' },
        ],
      },
      {
        name: 'Gazipur',
        bnName: 'গাজীপুর',
        slug: 'gazipur',
        areas: [
          { name: 'Joydebpur', bnName: 'জয়দেবপুর', slug: 'joydebpur' },
          { name: 'Tongi', bnName: 'টঙ্গী', slug: 'tongi' },
          { name: 'Konabari', bnName: 'কোনাবাড়ী', slug: 'konabari' },
          { name: 'Chowrasta', bnName: 'চৌরাস্তা', slug: 'chowrasta' },
        ],
      },
      {
        name: 'Narayanganj',
        bnName: 'নারায়ণগঞ্জ',
        slug: 'narayanganj',
        areas: [
          { name: 'Chashara', bnName: 'চাষাঢ়া', slug: 'chashara' },
          { name: 'Siddhirganj', bnName: 'সিদ্ধিরগঞ্জ', slug: 'siddhirganj' },
          { name: 'Fatullah', bnName: 'ফতুল্লা', slug: 'fatullah' },
        ],
      },
    ],
  },
  {
    name: 'Chattogram',
    bnName: 'চট্টগ্রাম',
    slug: 'chattogram',
    districts: [
      {
        name: 'Chattogram',
        bnName: 'চট্টগ্রাম',
        slug: 'chattogram',
        areas: [
          { name: 'Agrabad', bnName: 'আগ্রাবাদ', slug: 'agrabad' },
          { name: 'GEC Circle', bnName: 'জিইসি মোড়', slug: 'gec-circle' },
          { name: 'Nasirabad', bnName: 'নাসিরাবাদ', slug: 'nasirabad' },
          { name: 'Halishahar', bnName: 'হালিশহর', slug: 'halishahar' },
          { name: 'Panchlaish', bnName: 'পাঁচলাইশ', slug: 'panchlaish' },
          { name: 'Chawkbazar', bnName: 'চকবাজার', slug: 'chawkbazar' },
          { name: 'Khulshi', bnName: 'খুলশী', slug: 'khulshi' },
        ],
      },
      {
        name: "Cox's Bazar",
        bnName: 'কক্সবাজার',
        slug: 'coxs-bazar',
        areas: [
          { name: 'Kolatoli', bnName: 'কলাতলী', slug: 'kolatoli' },
          { name: 'Laboni Point', bnName: 'লাবণী পয়েন্ট', slug: 'laboni-point' },
          { name: 'Teknaf', bnName: 'টেকনাফ', slug: 'teknaf' },
        ],
      },
      {
        name: 'Cumilla',
        bnName: 'কুমিল্লা',
        slug: 'cumilla',
        areas: [
          { name: 'Kandirpar', bnName: 'কান্দিরপাড়', slug: 'kandirpar' },
          { name: 'Kotbari', bnName: 'কোটবাড়ী', slug: 'kotbari' },
          { name: 'Shashongachha', bnName: 'শাসনগাছা', slug: 'shashongachha' },
        ],
      },
    ],
  },
  {
    name: 'Rajshahi',
    bnName: 'রাজশাহী',
    slug: 'rajshahi',
    districts: [
      {
        name: 'Rajshahi',
        bnName: 'রাজশাহী',
        slug: 'rajshahi',
        areas: [
          { name: 'Shaheb Bazar', bnName: 'সাহেব বাজার', slug: 'shaheb-bazar' },
          { name: 'Motihar', bnName: 'মতিহার', slug: 'motihar' },
          { name: 'Boalia', bnName: 'বোয়ালিয়া', slug: 'boalia' },
          { name: 'Kazla', bnName: 'কাজলা', slug: 'kazla' },
          { name: 'Shirothoil', bnName: 'শিরোইল', slug: 'shiroil' },
        ],
      },
      {
        name: 'Bogura',
        bnName: 'বগুড়া',
        slug: 'bogura',
        areas: [
          { name: 'Satmatha', bnName: 'সাতমাথা', slug: 'satmatha' },
          { name: 'Sherpur', bnName: 'শেরপুর', slug: 'sherpur' },
          { name: 'Jaleshitola', bnName: 'জলেশ্বরীতলা', slug: 'jaleshitola' },
        ],
      },
      {
        name: 'Pabna',
        bnName: 'পাবনা',
        slug: 'pabna',
        areas: [
          { name: 'Pabna Sadar', bnName: 'পাবনা সদর', slug: 'pabna-sadar' },
          { name: 'Ishwardi', bnName: 'ঈশ্বরদী', slug: 'ishwardi' },
        ],
      },
    ],
  },
  {
    name: 'Sylhet',
    bnName: 'সিলেট',
    slug: 'sylhet',
    districts: [
      {
        name: 'Sylhet',
        bnName: 'সিলেট',
        slug: 'sylhet',
        areas: [
          { name: 'Zindabazar', bnName: 'জিন্দাবাজার', slug: 'zindabazar' },
          { name: 'Amberkhana', bnName: 'আম্বরখানা', slug: 'amberkhana' },
          { name: 'Shibganj', bnName: 'শিবগঞ্জ', slug: 'shibganj' },
          { name: 'Upashahar', bnName: 'উপশহর', slug: 'upashahar' },
          { name: 'Subidbazar', bnName: 'সুবিদবাজার', slug: 'subidbazar' },
          { name: 'Bandar Bazar', bnName: 'বন্দর বাজার', slug: 'bandar-bazar' },
        ],
      },
      {
        name: 'Moulvibazar',
        bnName: 'মৌলভীবাজার',
        slug: 'moulvibazar',
        areas: [
          { name: 'Sreemangal', bnName: 'শ্রীমঙ্গল', slug: 'sreemangal' },
          { name: 'Kulaura', bnName: 'কুলাউড়া', slug: 'kulaura' },
          { name: 'Moulvibazar Sadar', bnName: 'মৌলভীবাজার সদর', slug: 'moulvibazar-sadar' },
        ],
      },
      {
        name: 'Habiganj',
        bnName: 'হবিগঞ্জ',
        slug: 'habiganj',
        areas: [
          { name: 'Habiganj Sadar', bnName: 'হবিগঞ্জ সদর', slug: 'habiganj-sadar' },
          { name: 'Madhabpur', bnName: 'মাধবপুর', slug: 'madhabpur' },
        ],
      },
    ],
  },
  {
    name: 'Khulna',
    bnName: 'খুলনা',
    slug: 'khulna',
    districts: [
      {
        name: 'Khulna',
        bnName: 'খুলনা',
        slug: 'khulna',
        areas: [
          { name: 'Shib Bari', bnName: 'শিব বাড়ি', slug: 'shib-bari' },
          { name: 'Daulatpur', bnName: 'দৌলতপুর', slug: 'daulatpur' },
          { name: 'Boyra', bnName: 'বয়রা', slug: 'boyra' },
        ],
      },
      {
        name: 'Jashore',
        bnName: 'যশোর',
        slug: 'jashore',
        areas: [
          { name: 'Jashore Sadar', bnName: 'যশোর সদর', slug: 'jashore-sadar' },
        ],
      },
      {
        name: 'Kushtia',
        bnName: 'কুষ্টিয়া',
        slug: 'kushtia',
        areas: [
          { name: 'Kushtia Sadar', bnName: 'কুষ্টিয়া সদর', slug: 'kushtia-sadar' },
        ],
      },
    ],
  },
  {
    name: 'Barishal',
    bnName: 'বরিশাল',
    slug: 'barishal',
    districts: [
      {
        name: 'Barishal',
        bnName: 'বরিশাল',
        slug: 'barishal',
        areas: [
          { name: 'Sadar Road', bnName: 'সদর রোড', slug: 'sadar-road' },
          { name: 'Natun Bazar', bnName: 'নতুন বাজার', slug: 'natun-bazar' },
          { name: 'Rupatali', bnName: 'রূপাতলী', slug: 'rupatali' },
        ],
      },
      {
        name: 'Patuakhali',
        bnName: 'পটুয়াখালী',
        slug: 'patuakhali',
        areas: [
          { name: 'Kuakata', bnName: 'কুয়াকাটা', slug: 'kuakata' },
        ],
      },
      {
        name: 'Bhola',
        bnName: 'ভোলা',
        slug: 'bhola',
        areas: [
          { name: 'Bhola Sadar', bnName: 'ভোলা সদর', slug: 'bhola-sadar' },
        ],
      },
    ],
  },
  {
    name: 'Rangpur',
    bnName: 'রংপুর',
    slug: 'rangpur',
    districts: [
      {
        name: 'Rangpur',
        bnName: 'রংপুর',
        slug: 'rangpur',
        areas: [
          { name: 'Jahaj Company More', bnName: 'জাহাজ কোম্পানি মোড়', slug: 'jahaj-company-more' },
          { name: 'Modern More', bnName: 'মডার্ন মোড়', slug: 'modern-more' },
          { name: 'Medical More', bnName: 'মেডিকেল মোড়', slug: 'medical-more' },
        ],
      },
      {
        name: 'Dinajpur',
        bnName: 'দিনাজপুর',
        slug: 'dinajpur',
        areas: [
          { name: 'Dinajpur Sadar', bnName: 'দিনাজপুর সদর', slug: 'dinajpur-sadar' },
        ],
      },
      {
        name: 'Kurigram',
        bnName: 'কুড়িগ্রাম',
        slug: 'kurigram',
        areas: [],
      },
    ],
  },
  {
    name: 'Mymensingh',
    bnName: 'ময়মনসিংহ',
    slug: 'mymensingh',
    districts: [
      {
        name: 'Mymensingh',
        bnName: 'ময়মনসিংহ',
        slug: 'mymensingh',
        areas: [
          { name: 'Ganginar Par', bnName: 'গাঙ্গিনার পাড়', slug: 'ganginar-par' },
          { name: 'Town Hall', bnName: 'টাউন হল', slug: 'town-hall' },
          { name: 'Charpara', bnName: 'চরপাড়া', slug: 'charpara' },
        ],
      },
      {
        name: 'Jamalpur',
        bnName: 'জামালপুর',
        slug: 'jamalpur',
        areas: [
          { name: 'Jamalpur Sadar', bnName: 'জামালপুর সদর', slug: 'jamalpur-sadar' },
        ],
      },
      {
        name: 'Netrokona',
        bnName: 'নেত্রকোণা',
        slug: 'netrokona',
        areas: [],
      },
    ],
  },
];

async function seedCategories(): Promise<void> {
  console.log('🌱 Starting category seeding for "Kache" local marketplace...');

  for (const category of initialCategories) {
    const upsertedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        icon: category.icon,
        description: category.description,
        order: category.order,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description,
        order: category.order,
        isActive: true,
      },
    });

    console.log(
      `✅ Upserted Category: [${upsertedCategory.slug}] -> ${upsertedCategory.name} (ID: ${upsertedCategory.id})`
    );
  }

  console.log('✨ Categories seeded successfully!\n');
}

async function seedLocations(): Promise<void> {
  console.log('🌱 Starting location seeding (Divisions, Districts, Areas)...');

  for (const div of initialLocations) {
    const divisionRecord = await prisma.division.upsert({
      where: { slug: div.slug },
      update: {
        name: div.name,
        bnName: div.bnName,
      },
      create: {
        name: div.name,
        bnName: div.bnName,
        slug: div.slug,
      },
    });

    console.log(`📍 Division: ${divisionRecord.name} (${divisionRecord.bnName})`);

    for (const dist of div.districts) {
      const districtRecord = await prisma.district.upsert({
        where: {
          name_divisionId: {
            name: dist.name,
            divisionId: divisionRecord.id,
          },
        },
        update: {
          bnName: dist.bnName,
          slug: dist.slug,
        },
        create: {
          name: dist.name,
          bnName: dist.bnName,
          slug: dist.slug,
          divisionId: divisionRecord.id,
        },
      });

      console.log(`  ├── District: ${districtRecord.name} (${districtRecord.bnName})`);

      for (const area of dist.areas) {
        const areaRecord = await prisma.area.upsert({
          where: {
            name_districtId: {
              name: area.name,
              districtId: districtRecord.id,
            },
          },
          update: {
            bnName: area.bnName,
            slug: area.slug,
          },
          create: {
            name: area.name,
            bnName: area.bnName,
            slug: area.slug,
            districtId: districtRecord.id,
          },
        });

        console.log(`  │    └── Area: ${areaRecord.name} (${areaRecord.bnName})`);
      }
    }
  }

  console.log('\n✨ Locations seeded successfully!');
}

const DEFAULT_SEED_PASSWORD = 'Password123@';

interface IUserSeedItem {
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  shopName?: string;
  bio?: string;
  area?: string;
  address?: string;
}

interface IProductSeedItem {
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

const initialUsers: IUserSeedItem[] = [
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

const initialProducts: IProductSeedItem[] = [
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

async function seedUsers(): Promise<Record<string, string>> {
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

async function seedProducts(userIdMap: Record<string, string>): Promise<void> {
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
    await seedCategories();
    await seedLocations();
    const userIdMap = await seedUsers();
    await seedProducts(userIdMap);
    console.log('🎉 Full database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
