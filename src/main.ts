import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { MonitoringInterceptor } from './common/interceptors/monitoring.interceptor';
import { MonitoringService } from './monitoring/monitoring.service';
import * as compression from 'compression';
import helmet from 'helmet';
import { initSentry } from './config/sentry.config';
import { resolve } from 'path';

// Load environment variables before initializing Sentry
// This ensures ENABLE_SENTRY_IN_DEV and SENTRY_DSN are available
// Use require to avoid TypeScript import issues with dotenv
try {
  const dotenv = require('dotenv');
  const envPaths = [
    resolve(process.cwd(), '.env'), // Root of backend app
    resolve(__dirname, '../.env'), // One level up from dist
    resolve(__dirname, '../../.env'), // Two levels up (if running from dist/src)
  ];

  // Load the first .env file that exists
  for (const envPath of envPaths) {
    try {
      const result = dotenv.config({ path: envPath });
      if (!result.error) {
        break;
      }
    } catch (error) {
      // Continue to next path
    }
  }
} catch (error) {
  // Silently fall back to system environment variables
}

// Normalize ENABLE_SENTRY_IN_DEV value if set
const enableSentryInDev = process.env.ENABLE_SENTRY_IN_DEV;
if (enableSentryInDev !== undefined) {
  const normalized = enableSentryInDev.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    process.env.ENABLE_SENTRY_IN_DEV = 'true';
  }
}

// Initialize Sentry before anything else
initSentry();

async function bootstrap() {
  try {
    console.log('🚀 Starting backend server...');

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log'],
      bodyParser: true,
      rawBody: true, // required for Stripe webhook signature verification
    });

    // Handle common browser requests (favicon, robots.txt, etc.) to reduce log noise
    app.use((req, res, next) => {
      const ignoredPaths = ['/favicon.ico', '/robots.txt', '/apple-touch-icon.png', '/favicon.png'];
      if (ignoredPaths.some(path => req.url.includes(path))) {
        // Return 404 without creating an exception
        return res.status(404).json({
          error: 'Not Found',
          message: 'Resource not found',
        });
      }
      next();
    });

    // Filter unsupported HTTP methods (WebDAV, etc.) to reduce log noise
    app.use((req, res, next) => {
      const unsupportedMethods = ['PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'];
      if (unsupportedMethods.includes(req.method)) {
        // Return 405 Method Not Allowed without logging
        return res.status(405).json({
          error: 'Method Not Allowed',
          message: `${req.method} method is not supported`,
        });
      }
      next();
    });

    // Global body size limits (10MB for JSON/text, handled by multer for files)
    app.use((req, res, next) => {
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        // 10MB limit for JSON/text payloads (files handled separately by multer)
        if (size > 10 * 1024 * 1024) {
          return res.status(413).json({
            error: 'Payload too large',
            message: 'Request body size exceeds 10MB limit',
          });
        }
      }
      next();
    });

    console.log('✅ App module created successfully');

    // Security headers with Helmet
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        crossOriginEmbedderPolicy: false, // Allow embedding if needed
      }),
    );
    console.log('✅ Security headers (Helmet) enabled');

    // P2: Enable compression for responses with optimized settings
    app.use(
      compression({
        level: 6, // Balanced compression level (1-9)
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
          // Compress all JSON and text responses
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        },
      })
    );
    console.log('✅ Compression enabled with optimized settings');

    // Enable global exception filter
    app.useGlobalFilters(new AllExceptionsFilter());
    console.log('✅ Global exception filter enabled');

    // Enable global monitoring interceptor
    const monitoringService = app.get(MonitoringService);
    app.useGlobalInterceptors(new MonitoringInterceptor(monitoringService));
    console.log('✅ Global monitoring interceptor enabled');

    // Enable global validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    console.log('✅ Global validation pipes enabled');

    // Enable CORS for frontend communication
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.1.6:3000',
      'http://192.168.1.2:3000',
      'http://127.0.0.1:3000',
      'https://henzo.app',
      'https://www.henzo.app',
    ];

    // Add production frontend URL if set
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Allow any local network frontend like http://192.168.x.x:3000
        // Helpful when testing from different devices on the same LAN
        const lanFrontendRegex = /^http:\/\/192\.168\.\d+\.\d+:3000$/;
        if (lanFrontendRegex.test(origin)) {
          return callback(null, true);
        }

        // Allow Vercel preview deployments
        if (origin.includes('vercel.app')) {
          return callback(null, true);
        }

        // Reject other origins
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
      ],
      exposedHeaders: ['Content-Length', 'Content-Type'],
      maxAge: 3600,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
    console.log('✅ CORS enabled for:', allowedOrigins.join(', '));

    const port = process.env.PORT ?? 3001;
    await app.listen(port);

    console.log(`🚀 Backend is running on: http://localhost:${port}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(`📊 Metrics: http://localhost:${port}/metrics`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
