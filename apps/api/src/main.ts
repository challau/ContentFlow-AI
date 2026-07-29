import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './common/config/env';

/**
 * Locates the built SPA so a single process can serve both the API and the UI.
 *
 * Single-service hosts (Railway, Render, Fly) give you one port, so shipping
 * the frontend from a separate nginx container is not an option there.
 */
function findWebDist(): string | null {
  const candidates = [
    process.env.WEB_DIST_PATH,
    join(process.cwd(), 'apps/web/dist'),
    join(__dirname, '../../web/dist'),
    join(__dirname, '../../../apps/web/dist'),
  ].filter((p): p is string => Boolean(p));

  return candidates.find((p) => existsSync(join(p, 'index.html'))) ?? null;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);
  const logger = new Logger('bootstrap');

  const prefix = config.get('API_PREFIX', { infer: true });
  const port = config.get('PORT', { infer: true });
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix(prefix);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ContentFlow AI')
        .setDescription('One Topic. Every Platform. Powered by AI Agents.')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger UI at http://localhost:${port}/${prefix}/docs`);
  }

  const webDist = findWebDist();
  if (webDist) {
    // Vite emits content-hashed asset filenames, so they are safe to cache hard.
    app.use(
      '/assets',
      express.static(join(webDist, 'assets'), {
        maxAge: '1y',
        immutable: true,
      }),
    );
    app.use(express.static(webDist, { index: false }));

    // Client-side routing: anything that is not an API, docs or socket path
    // must return the app shell rather than a 404.
    const httpAdapter = app.getHttpAdapter().getInstance() as express.Express;
    httpAdapter.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });

    logger.log(`Serving web UI from ${webDist}`);
  } else {
    logger.warn('No web build found — running API only');
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`ContentFlow AI API listening on http://localhost:${port}/${prefix}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start ContentFlow AI:', error);
  process.exit(1);
});
