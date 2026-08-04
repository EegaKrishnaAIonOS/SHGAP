import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // T24/ADR-0033: this service had zero OpenAPI coverage before now — one
  // real route (`POST /notifications/dispatch`) plus health/metrics, so
  // this is a small, from-scratch addition rather than an extension of
  // existing docs the way core-api's Swagger setup already was.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SHGAP Notification Service')
    .setDescription(
      'Multi-channel (SMS/WhatsApp/voice/email) notification dispatch and delivery tracking, queued via BullMQ.',
    )
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
bootstrap();
