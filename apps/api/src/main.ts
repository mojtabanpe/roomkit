import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { AppModule } from './app/app.module';
import { WEBHOOK_PATH } from './app/usage/livekit-webhook.controller';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // LiveKit signs a sha256 of the exact bytes it posted, and sends them as
  // `application/webhook+json` — a content type Nest's JSON parser ignores, so
  // without this the handler would see an empty body. `type: () => true` keeps
  // it working if LiveKit ever changes that header.
  app.use(`/${globalPrefix}/${WEBHOOK_PATH}`, raw({ type: () => true }));

  // Strip unknown properties and reject malformed payloads.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Allow the Angular dev server (and configured origins) to call the API.
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
