// src/file-upload/file-upload.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import { extname } from 'path';
import * as os from 'os';
import { randomBytes } from 'crypto';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private configService: ConfigService) {
    // Get credentials from ConfigService
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');

    // Debug logging to see what values are being loaded
    console.log('========== CLOUDINARY CONFIG DEBUG ==========');
    console.log('CLOUDINARY_CLOUD_NAME:', cloudName);
    console.log('CLOUDINARY_API_KEY:', apiKey);
    console.log('CLOUDINARY_API_SECRET:', apiSecret ? '✓ (present)' : '✗ (missing)');
    console.log('=============================================');

    // Log configuration status
    this.logger.log(`Cloudinary configured with cloud name: ${cloudName ? '✓' : '✗'}`);
    this.logger.log(`Cloudinary API Key: ${apiKey ? '✓' : '✗'}`);
    this.logger.log(`Cloudinary API Secret: ${apiSecret ? '✓' : '✗'}`);

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  // Download a remote URL to a temp file and upload it to Cloudinary
  async uploadFromUrl(url: string, originalName: string): Promise<any> {
    const tmpDir = os.tmpdir();
    const ext = extname(originalName) || '';
    const tmpName = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const tmpPath = `${tmpDir.replace(/\\$/,'')}/${tmpName}`;

    // Use global fetch when available, otherwise dynamic import node-fetch
    const fetchFn = (globalThis as any).fetch || (await import('node-fetch')).default;

    try {
      const resp = await fetchFn(url);
      if (!resp.ok) {
        throw new Error(`Failed to download file: ${resp.status} ${resp.statusText}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));

      // Construct a minimal object compatible with uploadFile
      const fakeFile: any = {
        path: tmpPath,
        originalname: originalName,
        mimetype: resp.headers && resp.headers.get ? resp.headers.get('content-type') || undefined : undefined,
      };

      const result = await this.uploadFile(fakeFile as Express.Multer.File);

      // cleanup
      try { fs.unlinkSync(tmpPath); } catch (e) {}

      return result;
    } catch (err) {
      // ensure tmp file cleaned
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
      this.logger.error(`uploadFromUrl failed: ${err.message}`);
      throw new BadRequestException(`uploadFromUrl failed: ${err.message}`);
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    try {
      this.logger.log(`Uploading file to Cloudinary: ${file.originalname}`);

      // Check if file exists
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      if (!file.path) {
        throw new BadRequestException('File path is missing');
      }

      // Check if file exists on disk
      if (!fs.existsSync(file.path)) {
        throw new BadRequestException(`File not found at path: ${file.path}`);
      }

      // Get file stats
      const stats = fs.statSync(file.path);
      this.logger.log(`File size: ${stats.size} bytes`);

      if (stats.size === 0) {
        throw new BadRequestException('File is empty');
      }

      // Determine if file is a PDF by mimetype or extension
      const isPdf = (file.mimetype === 'application/pdf') || extname(file.originalname).toLowerCase() === '.pdf';
      const resourceType = isPdf ? 'raw' : 'auto';
      // Upload to Cloudinary using the file path
      let uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'medsure',
        resource_type: resourceType,
        public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
        overwrite: true,
      });

      // Extra validation: if we expected a PDF but Cloudinary didn't return a raw resource,
      // attempt a re-upload with resource_type 'raw' to ensure correct delivery headers.
      if (isPdf && uploadResult && uploadResult.resource_type !== 'raw') {
        this.logger.warn(`Expected Cloudinary resource_type 'raw' for PDF but got '${uploadResult.resource_type}'. Re-uploading as 'raw'.`);
        try {
          const reupload = await cloudinary.uploader.upload(file.path, {
            folder: 'medsure',
            resource_type: 'raw',
            public_id: `${Date.now()}-${file.originalname.split('.')[0]}-raw`,
            overwrite: true,
          });
          if (reupload && reupload.secure_url) {
            uploadResult = reupload;
            this.logger.log('Re-uploaded PDF as raw resource to Cloudinary');
          }
        } catch (reErr) {
          this.logger.error(`Re-upload as raw failed: ${reErr.message}`);
        }
      }

      // Check if upload was successful
      if (!uploadResult) {
        throw new BadRequestException('Cloudinary upload failed - no result returned');
      }

      this.logger.log(`Cloudinary upload successful: ${uploadResult.secure_url} (resource_type=${uploadResult.resource_type || resourceType})`);
      
      return uploadResult;

    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      
      // More detailed error logging
      if (error.http_code) {
        this.logger.error(`Cloudinary HTTP Error: ${error.http_code}`);
      }
      
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  async deleteFile(publicId: string): Promise<any> {
    try {
      this.logger.log(`Deleting file from Cloudinary: ${publicId}`);
      
      if (!publicId) {
        throw new BadRequestException('Public ID is required');
      }

      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        this.logger.log(`Cloudinary delete successful: ${publicId}`);
      } else {
        this.logger.warn(`Cloudinary delete returned: ${result.result}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`File delete failed: ${error.message}`);
      throw new BadRequestException(`File delete failed: ${error.message}`);
    }
  }

  async getFileInfo(publicId: string): Promise<any> {
    try {
      this.logger.log(`Getting file info from Cloudinary: ${publicId}`);
      
      if (!publicId) {
        throw new BadRequestException('Public ID is required');
      }

      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      this.logger.error(`File info fetch failed: ${error.message}`);
      throw new BadRequestException(`File info fetch failed: ${error.message}`);
    }
  }

  // Helper method to test Cloudinary connection
  async testConnection(): Promise<boolean> {
    try {
      const result = await cloudinary.api.ping();
      this.logger.log(`Cloudinary connection test: ${result.status === 'ok' ? '✓' : '✗'}`);
      return result.status === 'ok';
    } catch (error) {
      this.logger.error(`Cloudinary connection test failed: ${error.message}`);
      return false;
    }
  }
}