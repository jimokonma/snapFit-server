import { Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';

@Injectable()
export class FileSecurityService {
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ];

  private readonly allowedVideoTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxImageSize = 5 * 1024 * 1024; // 5MB for images

  validateFile(file: Express.Multer.File, type: 'image' | 'video' = 'image'): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size
    const maxSize = type === 'image' ? this.maxImageSize : this.maxFileSize;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
      );
    }

    // Check MIME type
    const allowedTypes = type === 'image' ? this.allowedImageTypes : this.allowedVideoTypes;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    // Check file extension
    const ext = extname(file.originalname).toLowerCase();
    const allowedExtensions = type === 'image' 
      ? ['.jpg', '.jpeg', '.png', '.webp']
      : ['.mp4', '.webm', '.mov'];
    
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`
      );
    }

    // Basic malware detection (check for suspicious patterns)
    this.checkForSuspiciousContent(file);
  }

  private checkForSuspiciousContent(file: Express.Multer.File): void {
    // Check for executable file signatures
    const buffer = file.buffer;
    const suspiciousSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class file
    ];

    for (const signature of suspiciousSignatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        throw new BadRequestException('Suspicious file detected');
      }
    }

    // Check for script tags in image files
    if (file.mimetype.startsWith('image/')) {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
      if (content.includes('<script') || content.includes('javascript:')) {
        throw new BadRequestException('Suspicious content detected in image');
      }
    }
  }

  sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts
    const sanitized = fileName
      .replace(/\.\./g, '') // Remove .. 
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars
      .substring(0, 100); // Limit length
    
    return sanitized;
  }
}









