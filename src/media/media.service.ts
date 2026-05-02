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
    this.fileSecurityService.validateFile(file, 'image');
    const sanitizedFolder = this.fileSecurityService.sanitizeFolderPath(folder);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: sanitizedFolder,
          resource_type: 'image',
          transformation: [{ quality: 'auto' }, { format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  /**
   * Upload a sensitive image as Cloudinary private delivery.
   * Returns the public_id (not a URL) — call generateSignedUrl() to serve it.
   */
  async uploadImagePrivate(
    file: Express.Multer.File,
    folder: string = 'snapfit',
  ): Promise<{ publicId: string; signedUrl: string }> {
    this.fileSecurityService.validateFile(file, 'image');
    const sanitizedFolder = this.fileSecurityService.sanitizeFolderPath(folder);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: sanitizedFolder,
          resource_type: 'image',
          type: 'private',
          transformation: [{ quality: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else
            resolve({
              publicId: result.public_id,
              signedUrl: this.generateSignedUrl(result.public_id),
            });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  /**
   * Generate a short-lived signed URL for a private Cloudinary asset.
   * Accepts either a raw public_id (new images) or a full legacy URL (old public images).
   * Legacy full URLs are returned as-is — they were uploaded as public and are already accessible.
   */
  generateSignedUrl(publicIdOrUrl: string, expiresInSeconds: number = 3600): string {
    if (!publicIdOrUrl) return '';
    // Legacy: old images were uploaded as public and stored as full URLs
    if (publicIdOrUrl.startsWith('http')) return publicIdOrUrl;
    return cloudinary.url(publicIdOrUrl, {
      type: 'private',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      secure: true,
      resource_type: 'image',
    });
  }

  async uploadVideo(file: Express.Multer.File, folder: string = 'snapfit'): Promise<string> {
    this.fileSecurityService.validateFile(file, 'video');
    const sanitizedFolder = this.fileSecurityService.sanitizeFolderPath(folder);
    
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

  async uploadFromUrl(url: string, folder: string = 'snapfit/exercises'): Promise<string> {
    const isConfigured = !!this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!isConfigured) return url;

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(url, { folder, resource_type: 'image' }, (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      });
    });
  }

  async deleteMedia(publicIdOrUrl: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    const publicId = publicIdOrUrl?.startsWith('http')
      ? this.extractPublicIdFromUrl(publicIdOrUrl)
      : publicIdOrUrl;
    if (!publicId) return;
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private extractPublicIdFromUrl(url: string): string | null {
    try {
      const uploadIdx = url.indexOf('/upload/');
      if (uploadIdx === -1) return null;
      let path = url.substring(uploadIdx + 8);
      // Strip version segment like v1234567890/
      path = path.replace(/^v\d+\//, '');
      const dotIdx = path.lastIndexOf('.');
      return dotIdx !== -1 ? path.substring(0, dotIdx) : path;
    } catch {
      return null;
    }
  }
}
