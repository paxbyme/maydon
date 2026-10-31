import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api/v1');
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
        'M1 public system endpoints. Business endpoints are not implemented.',
      )
      .setVersion('0.1.0')
      .build(),
  );
}
