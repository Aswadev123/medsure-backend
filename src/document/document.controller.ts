// src/document/document.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    userId?: string;
    id?: string;
    sub?: string;
    email?: string;
  };
}

@Controller('documents')
@UseGuards(SimpleAuthGuard)
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(
    private readonly documentService: DocumentService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Get()
  async getUserDocuments(@Req() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    this.logger.log(`Fetching documents for user: ${userId}`);
    const documents = await this.documentService.getUserDocuments(userId);
    
    return documents.map(doc => ({
      id: doc._id,
      originalName: doc.originalName,
      documentType: doc.documentType,
      status: doc.status,
      uploadDate: doc.uploadDate,
      url: doc.url,
      analysis: doc.analysis ? {
        confidence: doc.analysis.confidence,
        medicines: doc.analysis.medicines?.length || 0,
        warnings: doc.analysis.warnings?.length || 0,
        doctorName: doc.analysis.doctorInfo?.name
      } : null,
      ocrData: doc.ocrData ? {
        confidence: doc.ocrData.confidence,
        medications: doc.ocrData.medications?.length || 0
      } : null
    }));
  }

  @Get('recent')
  async getRecentDocuments(@Req() req: RequestWithUser, @Query('limit') limit?: number) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    const docs = await this.documentService.getRecentDocuments(userId, limit || 5);
    return docs;
  }

  @Get('stats')
  async getDocumentStats(@Req() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    return this.documentService.getDocumentStats(userId);
  }

  @Get('type/:type')
  async getDocumentsByType(@Req() req: RequestWithUser, @Param('type') type: string) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    return this.documentService.getDocumentsByType(userId, type);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    const document = await this.documentService.getDocumentById(id);
    return document;
  }

  @Get(':id/validate')
  async validateDocument(@Param('id') id: string) {
    const document = await this.documentService.getDocumentById(id);
    const result: any = { id, url: document.url || null, cloudinaryId: (document as any).cloudinaryId || null };
    try {
      // Check local file if available
      if (document.filename) {
        const fs = await import('fs');
        if (fs.existsSync(document.filename)) {
          const fd = fs.openSync(document.filename, 'r');
          const buf = Buffer.alloc(16);
          fs.readSync(fd, buf, 0, 16, 0);
          fs.closeSync(fd);
          result.local = {
            exists: true,
            sample: buf.toString('utf8', 0, Math.min(16, buf.length)),
            hex: buf.toString('hex').slice(0, 64),
          };
          // quick PDF signature check
          result.local.isPdf = result.local.sample.includes('%PDF');
        } else {
          result.local = { exists: false };
        }
      }

      // If there's a remote URL, fetch headers and a small chunk
      if (document.url) {
        const fetch = globalThis.fetch || (await import('node-fetch')).default;
        const resp = await fetch(document.url, { method: 'GET' });
        result.remote = {
          status: resp.status,
          headers: Object.fromEntries(Array.from(resp.headers.entries())),
        };
        try {
          const ab = await resp.arrayBuffer();
          const buf = Buffer.from(ab).slice(0, 64);
          result.remote.sample = buf.toString('utf8').slice(0, 64);
          result.remote.hex = buf.toString('hex').slice(0, 128);
          result.remote.isPdf = result.remote.sample.includes('%PDF');
        } catch (e) {
          result.remote.sampleError = String(e.message || e);
        }
      }

      return { success: true, result };
    } catch (error) {
      this.logger.error(`Validation failed for document ${id}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @Post(':id/reprocess')
  async reprocessDocument(@Param('id') id: string) {
    const document = await this.documentService.getDocumentById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const sourceUrl = document.url || (document as any).cloudinaryUrl || null;
    if (!sourceUrl) {
      throw new BadRequestException('No source URL available to reprocess');
    }

    this.logger.log(`Reprocessing document ${id} from ${sourceUrl}`);
    try {
      const uploadResult = await this.fileUploadService.uploadFromUrl(sourceUrl, document.originalName || document.filename || `doc-${id}`);

      // Update document record with new Cloudinary info if available
      const updatePayload: any = {};
      if (uploadResult.secure_url) updatePayload.url = uploadResult.secure_url;
      if (uploadResult.public_id) updatePayload.cloudinaryId = uploadResult.public_id;
      if (uploadResult.format) updatePayload.mimeType = uploadResult.format === 'pdf' ? 'application/pdf' : (document.mimeType || `application/${uploadResult.format}`);

      const updated = await this.documentService.updateDocument(id, updatePayload);

      return { success: true, uploadResult, updated };
    } catch (err) {
      this.logger.error(`Reprocess failed for ${id}: ${err.message}`);
      throw new BadRequestException(`Reprocess failed: ${err.message}`);
    }
  }

  @Post(':id/analyze')
  async analyzeDocument(@Param('id') id: string) {
    this.logger.log(`Manually triggering analysis for document: ${id}`);
    return this.documentService.analyzeDocument(id);
  }

  @Put(':id')
  async updateDocument(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentService.updateDocument(id, updateDocumentDto);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    return this.documentService.deleteDocument(id);
  }

  @Get('storage/total')
  async getTotalStorageUsed(@Req() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    const total = await this.documentService.getTotalStorageUsed(userId);
    return { total };
  }

  @Get('user/:id/count')
  async getUserDocumentCount(@Param('id') id: string) {
    this.logger.log(`Counting documents for user: ${id}`);
    const count = await this.documentService.getCountForUser(id);
    return { count };
  }

  @Get('analyses/user/:id/count')
  async getUserAnalysesCount(@Param('id') id: string) {
    this.logger.log(`Counting analyses for user: ${id}`);
    const count = await this.documentService.getAnalysesCountForUser(id);
    return { count };
  }
}