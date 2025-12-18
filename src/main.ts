import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import helmet from 'helmet';

import { GlobalExceptionFilter } from '@core/filters';
import { RequestLoggingInterceptor, ResponseWrapperInterceptor } from '@core/interceptors';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsWhitelist = configService.get<string>('CORS_WHITELIST', '');
  app.enableCors({
    origin: corsWhitelist.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(configService),
    new ResponseWrapperInterceptor(reflector),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Backend API')
    .setDescription('Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerUsername = configService.get<string>('SWAGGER_USERNAME', 'admin');
  const swaggerPassword = configService.get<string>('SWAGGER_PASSWORD', 'admin');

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  app.use(
    '/api/docs',
    basicAuth({
      users: { [swaggerUsername]: swaggerPassword },
      challenge: true,
      realm: 'Swagger',
    }),
  );

  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 4000);

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received. Starting graceful shutdown...');
    await app.close();
    logger.log('Application closed gracefully');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received. Starting graceful shutdown...');
    await app.close();
    logger.log('Application closed gracefully');
    process.exit(0);
  });

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  logger.log(`Health check: http://localhost:${port}/api/health`);
}

bootstrap();
