// src/common/services/cloudinary.service.ts
import { Injectable } from '@nestjs/common';

export interface UploadApiResponse {
  secure_url: string;
  public_id: string;
  [key: string]: any;
}

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    // Mock upload for now
    console.log('Mock uploading file:', file.originalname);
    
    return {
      secure_url: `https://mock-cloudinary.com/${file.filename}`,
      public_id: `mock_${Date.now()}`,
      original_filename: file.originalname,
      format: file.mimetype.split('/')[1],
      bytes: file.size,
    };
  }
}