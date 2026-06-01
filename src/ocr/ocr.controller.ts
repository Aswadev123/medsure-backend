// medsure-backend/src/ocr/ocr.controller.ts
import { 
  Controller, 
  Post, 
  UploadedFile, 
  UseInterceptors, 
  BadRequestException,
  Logger 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Controller('ocr')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/temp',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only images and PDFs are allowed'), false);
      }
    }
  }))
  async extractText(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`Processing OCR for file: ${file.originalname}`);

    try {
      const result = await this.ocrService.extractTextFromImage(file.path);
      
      // Clean up the temp file
      fs.unlink(file.path, (err) => {
        if (err) this.logger.warn(`Failed to delete temp file: ${err.message}`);
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`OCR processing failed: ${error.message}`);
      throw new BadRequestException(`OCR failed: ${error.message}`);
    }
  }
}