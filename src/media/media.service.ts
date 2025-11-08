import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { FileSecurityService } from '../common/services/file-security.service';

@Injectable()
export class MediaService {
  constructor(
    private configService: ConfigService,
    private fileSecurityService: FileSecurityService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'snapfit'): Promise<string> {
    // Validate file security
    this.fileSecurityService.validateFile(file, 'image');
    
    // Sanitize folder path
    const sanitizedFolder = this.fileSecurityService.sanitizeFileName(folder);
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: sanitizedFolder,
          resource_type: 'image',
          transformation: [
            { quality: 'auto' },
            { format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async uploadVideo(file: Express.Multer.File, folder: string = 'snapfit'): Promise<string> {
    // Validate file security
    this.fileSecurityService.validateFile(file, 'video');
    
    // Sanitize folder path
    const sanitizedFolder = this.fileSecurityService.sanitizeFileName(folder);
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: sanitizedFolder,
          resource_type: 'video',
          transformation: [
            { quality: 'auto' },
            { format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteMedia(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
