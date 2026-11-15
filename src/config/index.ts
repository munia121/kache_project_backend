import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  env: process.env.NODE_ENV,
  prisma_database_url: process.env.DATABASE_URL,
  mongodb_database_url: process.env.MONGODB_DATABASE_URL,
  client_url: process.env.CLIENT_URL,
  port: process.env.PORT || 5000,
  redis_url: process.env.REDIS_URL ,
  smtp_host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  smtp_port: parseInt(process.env.SMTP_PORT || '2525', 10),
  smtp_user: process.env.SMTP_USER || '',
  smtp_pass: process.env.SMTP_PASS || '',
  smtp_from: process.env.SMTP_FROM || 'no-reply@mobile-banking.com',
  jwt_secret: process.env.JWT_SECRET || 'default_jwt_secret_key_12345',
  jwt_expires_in: process.env.JWT_EXPIRES_IN || '7d',
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key_12345',
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY || '',
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET || '',
};
