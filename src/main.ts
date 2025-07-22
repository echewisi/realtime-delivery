import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    // Create the application instance with specific platform
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      cors: true
    });

    // Security middleware
    app.use(compression());

    // Set global prefix for all routes
    app.setGlobalPrefix('api');

    // Configure Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('Realtime Delivery API')
      .setDescription('API documentation for the Realtime Delivery System')
      .setVersion('1.0')
      .addTag('orders', 'Order management endpoints')
      .addTag('riders', 'Rider management endpoints')
      .addTag('dispatch', 'Dispatch system endpoints')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
    });

    // Configure WebSocket adapter
    app.useWebSocketAdapter(new WsAdapter(app));

    // Validation pipe configuration
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      },
      disableErrorMessages: process.env.NODE_ENV === 'production'
    }));

    // CORS configuration
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 3600
    });

    // Trust proxy if behind reverse proxy
    // if (process.env.NODE_ENV === 'production') {
    //   app.set('trust proxy', 1);
    // }

    // // Configure timeouts
    // app.set('socket timeout', 600000); // 10 minutes
    // app.set('keepAliveTimeout', 620000); // 10 minutes + 20 seconds

    // Start listening
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen(port, host);
    
    logger.log(`🚀 Application is running on: http://${host}:${port}`);
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`Database: ${process.env.DB_HOST || 'localhost'}`);
    
    // Graceful shutdown
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.warn(`Received ${signal}, starting graceful shutdown...`);
        
        try {
          await app.close();
          logger.log('Application shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    });

  } catch (error) {
    logger.error('Error during application bootstrap:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  Logger.error(
    'Unhandled Promise Rejection',
    reason instanceof Error ? reason.stack : reason,
    'Unhandled Promise'
  );
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error(
    'Uncaught Exception',
    error.stack,
    'Uncaught Exception'
  );
  process.exit(1);
});

bootstrap();
