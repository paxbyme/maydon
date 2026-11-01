import { SecurityKeys } from './identity/security-keys';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApiExceptionFilter, requestIdMiddleware } from './common/http-errors';

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: app.get(SecurityKeys).allowedOrigins,
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  return app;
}

export function createDocument(app: Awaited<ReturnType<typeof createApp>>) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('MAYDON API')
      .setDescription(
        'Identity and scoped access APIs; reservation and game endpoints are pending.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
}
