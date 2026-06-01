// src/document/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { DocumentService } from './document.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { OcrService } from '../ocr/ocr.service';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

interface RequestWithUser extends Request {
  user?: {
    userId?: string;
    id?: string;
    sub?: string;
    email?: string;
  };
}

@Controller('upload')
@UseGuards(SimpleAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly documentService: DocumentService,
    private readonly fileUploadService: FileUploadService,
    private readonly ocrService: OcrService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = './uploads';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      // Accept all file types. Validation (if any) should be performed elsewhere.
      cb(null, true);
    }
  }))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    this.logger.log('=== UPLOAD START ===');
    
    try {
      // Get userId from authenticated user
      let userId: string | null = null;
      
      if (req.user) {
        userId = req.user.userId || req.user.id || req.user.sub || null;
      }
      
      this.logger.log(`Extracted userId: ${userId}`);
      
      if (!userId) {
        this.logger.error('No user ID found in request');
        throw new BadRequestException('User not authenticated. Please login again.');
      }
      
      // Validate userId format
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
      if (!isValidObjectId) {
        this.logger.error(`Invalid userId format: ${userId}`);
        throw new BadRequestException('Invalid user ID format');
      }
      
      if (!file) {
        this.logger.error('No file uploaded');
        throw new BadRequestException('No file uploaded');
      }

      // Verify file was saved correctly
      if (!fs.existsSync(file.path)) {
        this.logger.error(`File not saved at path: ${file.path}`);
        throw new BadRequestException('File upload failed');
      }

      const stats = fs.statSync(file.path);
      this.logger.log(`File received: ${file.originalname}, Size: ${stats.size} bytes, Path: ${file.path}`);

      this.logger.log('Starting file upload to Cloudinary...');
      
      // Upload to Cloudinary
      const uploadResult = await this.fileUploadService.uploadFile(file);
      this.logger.log(`File uploaded to Cloudinary (initial): ${uploadResult?.secure_url}`);

      // Try to fetch Cloudinary metadata to confirm format/resource_type
      let cloudInfo: any = null;
      try {
        if (uploadResult?.public_id) {
          cloudInfo = await this.fileUploadService.getFileInfo(uploadResult.public_id);
          this.logger.log(`Cloudinary resource info: ${JSON.stringify({ resource_type: cloudInfo.resource_type, format: cloudInfo.format, secure_url: cloudInfo.secure_url })}`);
        }
      } catch (infoErr) {
        this.logger.warn(`Failed to fetch Cloudinary file info: ${infoErr.message}`);
      }

      // Prepare document data
      const createDocumentDto = {
        filename: file.path, // Local path for OCR processing (if needed)
        originalName: file.originalname,
        fileType: extname(file.originalname).substring(1),
        // Prefer Cloudinary-detected format for MIME when available
        mimeType: (cloudInfo && cloudInfo.format === 'pdf') ? 'application/pdf' : (file.mimetype || `application/${cloudInfo?.format || 'octet-stream'}`),
        size: stats.size,
        url: (cloudInfo && cloudInfo.secure_url) ? cloudInfo.secure_url : uploadResult.secure_url,
        cloudinaryId: uploadResult.public_id,
        documentType: body.documentType || 'prescription',
        notes: body.notes || '',
        doctorName: body.doctorName || '',
      };

      this.logger.log('Creating document in database...');
      const document = await this.documentService.createDocument(userId, createDocumentDto);

      this.logger.log(`Document saved successfully with ID: ${document._id}`);
      this.logger.log('=== UPLOAD COMPLETE ===');

      return {
        success: true,
        message: 'File uploaded successfully. Processing started.',
        document: {
          id: document._id.toString(),
          filename: document.originalName,
          url: document.url,
          documentType: document.documentType,
          status: document.status,
          uploadedAt: document.uploadDate,
        },
      };
    } catch (error: any) {
      this.logger.error('Upload failed with error:', error);
      
      // Clean up local file if upload failed
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
          this.logger.log(`Cleaned up local file: ${file.path}`);
        } catch (cleanupError) {
          this.logger.error(`Failed to clean up file: ${cleanupError.message}`);
        }
      }
      
      this.logger.log('=== UPLOAD FAILED ===');
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Post('direct-ocr')
  @UseGuards(SimpleAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = './uploads/temp';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `ocr-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async directOcr(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`Direct OCR for file: ${file.originalname}`);

    try {
      // Verify file exists
      if (!fs.existsSync(file.path)) {
        throw new Error('File not saved correctly');
      }

      const stats = fs.statSync(file.path);
      this.logger.log(`File size: ${stats.size} bytes`);

      await this.ocrService.initializeWorker();
      const result = await this.ocrService.extractTextFromImage(file.path);
      
      // Clean up
      await this.ocrService.terminateWorker();
      
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error(`Direct OCR failed: ${error.message}`);
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          this.logger.error(`Failed to clean up file: ${cleanupError.message}`);
        }
      }
      throw new BadRequestException(`OCR failed: ${error.message}`);
    }
  }
}