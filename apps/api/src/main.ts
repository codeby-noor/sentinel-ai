import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getEnv } from './config/env';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule, { cors: false });

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-API-Key'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  await app.listen(env.API_PORT, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Sentinel API listening on :${env.API_PORT} (env=${env.NODE_ENV})`);
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API:', e);
  process.exit(1);
});
