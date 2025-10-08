import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Starting backend server...');

    const app = await NestFactory.create(AppModule);
    console.log('✅ App module created successfully');

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
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://192.168.1.6:3000',
        'http://127.0.0.1:3000',
      ],
      credentials: true,
    });
    console.log('✅ CORS enabled');

    const port = process.env.PORT ?? 3001;
    await app.listen(port);

    console.log(`🚀 Backend is running on: http://localhost:${port}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
