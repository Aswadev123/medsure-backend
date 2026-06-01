import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { OCRProcessor } from './processors/ocrProcessor';
import { FileValidator } from './utils/fileValidator';
import { OCRResult, OCRError } from './types';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
// Allow larger JSON payloads (base64 uploads) up to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: FileValidator.getMaxFileSize()
  }
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get supported file types and languages
app.get('/api/info', (req, res) => {
  res.json({
    supportedTypes: OCRProcessor.getSupportedTypes(),
    supportedLanguages: OCRProcessor.getSupportedLanguages(),
    maxFileSize: `${FileValidator.getMaxFileSize() / (1024 * 1024)}MB`
  });
});

// Main OCR endpoint
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const language = req.body.language || 'eng';
    // Support two modes: multipart file upload (req.file) or JSON { base64, filename, mimetype }
    let buffer: Buffer | null = null;
    let mimetype = 'application/octet-stream';
    let originalName = 'upload';

    if (file) {
      // Validate file
      const validation = FileValidator.validateFile(file);
      if (!validation.isValid) {
        const error: OCRError = {
          error: 'Validation Error',
          message: validation.error!
        };
        return res.status(400).json(error);
      }
      buffer = file.buffer;
      mimetype = file.mimetype;
      originalName = validation.fileInfo!.originalName;
    } else if (req.is('application/json') && req.body.base64) {
      // Accept base64 JSON payload
      try {
        buffer = Buffer.from(req.body.base64, 'base64');
        mimetype = req.body.mimetype || 'application/pdf';
        originalName = req.body.filename || 'upload';
      } catch (err) {
        const error: OCRError = { error: 'Validation Error', message: 'Invalid base64 payload' };
        return res.status(400).json(error);
      }
    } else {
      const error: OCRError = {
        error: 'Validation Error',
        message: 'No file provided'
      };
      return res.status(400).json(error);
    }

    console.log(`Processing file: ${originalName} (${mimetype})`);

    // Process file
    const result: OCRResult = await OCRProcessor.processFile(buffer!, mimetype, language);

    console.log(`OCR completed in ${result.processingTime}ms`);

    res.json({
      success: true,
      data: result,
      fileInfo: { originalName, mimeType: mimetype }
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    
    const errorResponse: OCRError = {
      error: 'Processing Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    res.status(500).json(errorResponse);
  }
});

// Serve the web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  const errorResponse: OCRError = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  };
  
  res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OCR API Server running on http://localhost:${PORT}`);
  console.log(`📄 Web interface available at http://localhost:${PORT}`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api/ocr`);
  console.log(`ℹ️  API info: http://localhost:${PORT}/api/info`);
});

export default app;
