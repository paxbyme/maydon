import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { validateEnvironment } from './config';
import { OutboxModule } from './outbox/outbox.module';
import { OutboxWorker } from './outbox/outbox.worker';

@Module({ imports: [OutboxModule], providers: [OutboxWorker] })
class WorkerModule {}

async function main() {
  validateEnvironment(process.env);
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is required for the worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}
void main();
