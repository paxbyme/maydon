import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { validateEnvironment } from './config';

@Module({})
class WorkerModule {}

async function main() {
  validateEnvironment(process.env);
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  // M2 adds durable outbox polling. This process has no delivery handlers yet.
  const keepAlive = setInterval(() => {}, 60_000);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => clearInterval(keepAlive));
  }
}
void main();
