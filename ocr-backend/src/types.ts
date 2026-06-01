export interface OCRResult {
  text: string;
  confidence?: number;
  language?: string;
  processingTime?: number;
}

export interface OCRError {
  error: string;
  message: string;
  code?: string;
}

export interface FileInfo {
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
}

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp'
];

export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf'
];

export const ALL_SUPPORTED_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES
];
