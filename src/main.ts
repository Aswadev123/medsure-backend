import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
app.enableCors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://medsure-ui.vercel.app'
  ],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
});

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
    }),
  );


  app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});


app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
  // -----------------------------
  // Upload folders setup
  // -----------------------------
  const uploadsPath = join(process.cwd(), 'uploads');
  const tempUploadsPath = join(process.cwd(), 'uploads', 'temp');

  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
    console.log(`📁 Created uploads directory at: ${uploadsPath}`);
  }

  if (!existsSync(tempUploadsPath)) {
    mkdirSync(tempUploadsPath, { recursive: true });
    console.log(`📁 Created temp uploads directory at: ${tempUploadsPath}`);
  }

  // Serve static files
  app.use('/uploads', express.static(uploadsPath));

  console.log(`📁 Static files served from: ${uploadsPath}`);

  // -----------------------------
  // ENV CONFIG (PRODUCTION SAFE)
  // -----------------------------
  const port = process.env.PORT || 10000;

  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.BASE_URL
      : `http://localhost:${port}`;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend is running on: ${baseUrl}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛠️ API URL: ${baseUrl}`);
}

bootstrap();