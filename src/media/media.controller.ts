import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image' })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const url = await this.mediaService.uploadImage(file, `snapfit/users/${req.user.sub}`);
    return { url };
  }

  @Post('upload/video')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload video' })
  @ApiResponse({ status: 201, description: 'Video uploaded successfully' })
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const url = await this.mediaService.uploadVideo(file, `snapfit/users/${req.user.sub}`);
    return { url };
  }
}
