# Free OCR API

A powerful, free, and unlimited Optical Character Recognition (OCR) API that extracts text from images and PDFs. Built with TypeScript, Express.js, and Tesseract.js for reliable text extraction without any limits or hidden costs.

## 🚀 Features

- **No rate limits:** Use as much as you want, whenever you want
- **Free and open source:** No API keys, no subscriptions, no hidden fees
- **Multiple file types:** Support for images (JPG, PNG, GIF, BMP, TIFF, WebP) and PDFs
- **Multi-language support:** 13+ languages including English, Spanish, French, German, Chinese, Japanese, and more
- **Web interface:** Simple drag-and-drop interface for testing
- **Fast processing:** Built on optimized OCR technology
- **TypeScript:** Fully typed for better development experience

## 📋 Supported File Types

### Images
- JPEG/JPG
- PNG
- GIF
- BMP
- TIFF
- WebP

### Documents
- PDF (text extraction)

### Languages (for images)
- English (eng)
- Spanish (spa)
- French (fra)
- German (deu)
- Italian (ita)
- Portuguese (por)
- Russian (rus)
- Chinese Simplified (chi_sim)
- Chinese Traditional (chi_tra)
- Japanese (jpn)
- Korean (kor)
- Arabic (ara)
- Hindi (hin)

## 🛠️ Installation & Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd ocr
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Start the server:**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📖 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-28T20:48:19.632Z"
}
```

#### API Information
```http
GET /api/info
```

**Response:**
```json
{
  "supportedTypes": {
    "images": ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp", "image/tiff", "image/webp"],
    "documents": ["application/pdf"]
  },
  "supportedLanguages": ["eng", "spa", "fra", "deu", "ita", "por", "rus", "chi_sim", "chi_tra", "jpn", "kor", "ara", "hin"],
  "maxFileSize": "50MB"
}
```

#### OCR Processing
```http
POST /api/ocr
```

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: The image or PDF file to process
  - `language`: (optional) Language code for OCR (default: 'eng', only applies to images)

**Example using curl:**
```bash
curl -X POST \
  -F "file=@example.jpg" \
  -F "language=eng" \
  http://localhost:3000/api/ocr
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "text": "Extracted text from the file",
    "confidence": 95.5,
    "language": "eng",
    "processingTime": 1250
  },
  "fileInfo": {
    "originalName": "example.jpg",
    "mimeType": "image/jpeg",
    "size": 245760,
    "extension": ".jpg"
  }
}
```

**Error Response (400/500):**
```json
{
  "error": "Validation Error",
  "message": "Unsupported file type: image/svg+xml"
}
```

## 🌐 Web Interface

Visit `http://localhost:3000` to access the web interface for testing the API:

- **Drag & Drop:** Simply drag files onto the upload area
- **File Browser:** Click to browse and select files
- **Language Selection:** Choose OCR language for image processing
- **Real-time Results:** View extracted text immediately
- **Copy Function:** One-click copy of extracted text

## 🔧 Tech Stack

- **Backend:** Node.js + Express.js + TypeScript
- **OCR Engine:** Tesseract.js (for images)
- **PDF Processing:** pdf-parse
- **File Upload:** Multer
- **Frontend:** HTML5 + Tailwind CSS + Vanilla JavaScript

## 📝 Usage Examples

### JavaScript/Node.js
```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function extractText(filePath, language = 'eng') {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('language', language);

  const response = await fetch('http://localhost:3000/api/ocr', {
    method: 'POST',
    body: form
  });

  const result = await response.json();
  return result.data.text;
}

// Usage
extractText('./document.jpg', 'eng')
  .then(text => console.log('Extracted:', text))
  .catch(err => console.error('Error:', err));
```

### Python
```python
import requests

def extract_text(file_path, language='eng'):
    with open(file_path, 'rb') as file:
        files = {'file': file}
        data = {'language': language}

        response = requests.post(
            'http://localhost:3000/api/ocr',
            files=files,
            data=data
        )

        if response.status_code == 200:
            return response.json()['data']['text']
        else:
            raise Exception(f"Error: {response.json()['message']}")

# Usage
try:
    text = extract_text('./document.jpg', 'eng')
    print(f"Extracted: {text}")
except Exception as e:
    print(f"Error: {e}")
```

### cURL
```bash
# Extract text from an image
curl -X POST \
  -F "file=@document.jpg" \
  -F "language=eng" \
  http://localhost:3000/api/ocr

# Extract text from a PDF
curl -X POST \
  -F "file=@document.pdf" \
  http://localhost:3000/api/ocr
```

## 🚦 Error Handling

The API returns appropriate HTTP status codes and error messages:

- **400 Bad Request:** Invalid file type, missing file, or file too large
- **500 Internal Server Error:** Processing errors or server issues

Common error scenarios:
- File size exceeds 50MB limit
- Unsupported file format
- Corrupted or invalid file
- OCR processing failure

## 🔒 Security & Limitations

- **File Size Limit:** 50MB maximum per file
- **Memory Usage:** Files are processed in memory for security
- **No Persistence:** Uploaded files are not stored on the server
- **CORS Enabled:** API accessible from any origin

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

- **Issues:** Report bugs or request features via GitHub Issues
- **Documentation:** Check this README for comprehensive API documentation
- **Testing:** Use the web interface at `http://localhost:3000` for quick testing

## 🎯 Use Cases

- **Document Digitization:** Convert scanned documents to editable text
- **Receipt Processing:** Extract data from receipts and invoices
- **Screenshot OCR:** Convert screenshots to searchable text
- **Accessibility:** Make images accessible with text extraction
- **Data Entry Automation:** Automate manual data entry from images
- **Content Moderation:** Extract text from images for content analysis
- **Archive Digitization:** Convert old documents and photos to text

---

**Made with ❤️ for the developer community. No limits, no costs, just OCR.**

