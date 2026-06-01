// src/utils/create-upload-dirs.ts
import * as fs from 'fs';
import * as path from 'path';

export function ensureUploadDirectories() {
  const dirs = [
    './uploads',
    './uploads/temp'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}