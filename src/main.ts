import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });

  const swaggerBuilder = new DocumentBuilder()
    .setTitle('Expense Management API')
    .setDescription('Employee expense claims, wallet, and OTP authentication')
    .setVersion('1.0')
    .addBearerAuth();

  if (process.env.PUBLIC_BASE_URL) {
    swaggerBuilder.addServer(process.env.PUBLIC_BASE_URL);
  }

  const swaggerConfig = swaggerBuilder.build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT || 5020);
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}/api`);
  console.log(`Swagger UI: http://${host}:${port}/docs`);
}

bootstrap();
