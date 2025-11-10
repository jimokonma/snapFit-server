import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BodyAnalysisService } from './body-analysis.service';
import { PhotoType } from '../common/schemas/body-analysis.schema';

@ApiTags('Body Analysis')
@Controller('body-analysis')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BodyAnalysisController {
  constructor(private readonly bodyAnalysisService: BodyAnalysisService) {}

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Upload a single body photo with MediaPipe validation' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
        },
        photoType: {
          type: 'string',
          enum: Object.values(PhotoType),
          description: 'Type of photo: upper_front, upper_back, upper_side, lower_front, lower_back, lower_side',
        },
        landmarks: {
          type: 'string',
          description: 'Optional: Pre-processed MediaPipe landmarks as JSON string',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Photo uploaded and analyzed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid photo type or missing file' })
  async uploadPhoto(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('photoType') photoType: string,
    @Body('landmarks') landmarks?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }

    if (!photoType || !Object.values(PhotoType).includes(photoType as PhotoType)) {
      throw new BadRequestException(
        `Invalid photo type. Must be one of: ${Object.values(PhotoType).join(', ')}`
      );
    }

    let preProcessedLandmarks = null;
    if (landmarks) {
      try {
        preProcessedLandmarks = JSON.parse(landmarks);
      } catch (error) {
        throw new BadRequestException('Invalid landmarks JSON format');
      }
    }

    return this.bodyAnalysisService.uploadPhoto(
      user.sub,
      file,
      photoType as PhotoType,
      preProcessedLandmarks
    );
  }

  @Post('complete')
  @ApiOperation({ summary: 'Complete 6-photo analysis and generate comprehensive report' })
  @ApiResponse({ status: 200, description: 'Comprehensive analysis generated successfully' })
  @ApiResponse({ status: 404, description: 'No body photos found' })
  async completeAnalysis(@CurrentUser() user: any) {
    return this.bodyAnalysisService.completeAnalysis(user.sub);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest comprehensive analysis for current user' })
  @ApiResponse({ status: 200, description: 'Latest analysis retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No analysis found' })
  async getLatestAnalysis(@CurrentUser() user: any) {
    return this.bodyAnalysisService.getLatestAnalysis(user.sub);
  }

  @Get('photos')
  @ApiOperation({ summary: 'Get all uploaded photos with validation status' })
  @ApiResponse({ status: 200, description: 'Photos retrieved successfully' })
  async getUserPhotos(@CurrentUser() user: any) {
    return this.bodyAnalysisService.getUserPhotos(user.sub);
  }

  @Get(':userId/latest')
  @ApiOperation({ summary: 'Get latest comprehensive analysis for a specific user (admin)' })
  @ApiResponse({ status: 200, description: 'Latest analysis retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No analysis found' })
  async getLatestAnalysisByUserId(@Param('userId') userId: string) {
    return this.bodyAnalysisService.getLatestAnalysis(userId);
  }

  @Delete('photo/:photoType')
  @ApiOperation({ summary: 'Delete a specific body photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  async deletePhoto(
    @CurrentUser() user: any,
    @Param('photoType') photoType: string,
  ) {
    if (!Object.values(PhotoType).includes(photoType as PhotoType)) {
      throw new BadRequestException(`Invalid photo type: ${photoType}`);
    }

    await this.bodyAnalysisService.deletePhoto(user.sub, photoType as PhotoType);
    return { message: `Photo of type ${photoType} deleted successfully` };
  }
}

