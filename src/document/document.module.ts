// src/document/document.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentController } from './document.controller';
import { UploadController } from './upload.controller';
import { DocumentService } from './document.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { Document, DocumentSchema } from './document.schema';
import { AiModule } from '../ai/ai.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }]),
    AiModule,
     OcrModule,
    FileUploadModule,
  ],
  controllers: [DocumentController, UploadController],
  providers: [DocumentService, FileUploadService],
  exports: [DocumentService],
})
export class DocumentModule {}