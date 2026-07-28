import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './common/config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
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

  await app.listen(port, '0.0.0.0');
  logger.log(`ContentFlow AI API listening on http://localhost:${port}/${prefix}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start ContentFlow AI:', error);
  process.exit(1);
});
