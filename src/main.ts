import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { MonitoringInterceptor } from './common/interceptors/monitoring.interceptor';
import { MonitoringService } from './monitoring/monitoring.service';
import * as compression from 'compression';

async function bootstrap() {
  try {
    console.log('🚀 Starting backend server...');

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    console.log('✅ App module created successfully');

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
