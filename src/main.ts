// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: false,
  }));

  // Create uploads directory if it doesn't exist
  const uploadsPath = join(process.cwd(), 'uploads');
  const tempUploadsPath = join(process.cwd(), 'uploads', 'temp');
  
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
    console.log(`📁 Created uploads directory at: ${uploadsPath}`);
  }
  
  // Create temp uploads directory if it doesn't exist
  if (!existsSync(tempUploadsPath)) {
    mkdirSync(tempUploadsPath, { recursive: true });
    console.log(`📁 Created temp uploads directory at: ${tempUploadsPath}`);
  }

  // Serve static files from the project root uploads folder
  app.use('/uploads', express.static(uploadsPath));
  
  console.log(`📁 Static files served from: ${uploadsPath}`);

  // Global prefix (optional - uncomment if you want all routes prefixed with 'api')
  // app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend is running on: http://localhost:${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🛠️  API URL: http://localhost:${port}`);
}

bootstrap();