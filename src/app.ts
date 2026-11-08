import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config';
import router from './routes';
import notFound from './middlewares/notFound';
import globalErrorHandler from './middlewares/globalErrorHandler';

const app: Application = express();

// ==========================================
// Global Middlewares
// ==========================================
const allowedOrigins: (string | RegExp)[] = [
  'https://kache-pink.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  /^http:\/\/localhost:[0-9]+$/,
  /^http:\/\/127\.0\.0\.1:[0-9]+$/,
  ...(config.client_url
    ? config.client_url.split(',').map((url) => url.trim()).filter(Boolean)
    : []),
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// Health & Root Information Routes
// ==========================================
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the E-commerce Backend API',
    version: '1.0.0',
    environment: config.env,
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// Application API Routes
// ==========================================
app.use('/api', router);
app.use('/api/v1', router);

// ==========================================
// 404 Not Found Handler
// ==========================================
app.use(notFound);

// ==========================================
// Global Error Handler
// ==========================================
app.use(globalErrorHandler);

export default app;
