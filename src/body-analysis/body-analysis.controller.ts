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
import { memoryStorage } from 'multer';
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
  @UseInterceptors(FileInterceptor('photo', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  @ApiOperation({ summary: 'Upload a body photo — Claude validates immediately and returns feedback' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
        photoType: {
          type: 'string',
          enum: Object.values(PhotoType),
          description: 'upper_front | upper_back | side_profile | full_body',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Photo uploaded and validated. Returns { imageUrl, validation: { passed, issues, feedback } }' })
  async uploadPhoto(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('photoType') photoType: string,
  ) {
    if (!file) throw new BadRequestException('Photo file is required');

    if (!photoType || !Object.values(PhotoType).includes(photoType as PhotoType)) {
      throw new BadRequestException(
        `Invalid photo type. Must be one of: ${Object.values(PhotoType).join(', ')}`,
      );
    }

    return this.bodyAnalysisService.uploadAndValidatePhoto(
      user.sub,
      file,
      photoType as PhotoType,
    );
  }

  @Post('complete')
  @ApiOperation({ summary: 'Analyze all 4 photos with Claude and generate 7-day workout plan' })
  @ApiResponse({ status: 200, description: 'Body analysis + workout plan generated successfully' })
  async completeAnalysis(@CurrentUser() user: any) {
    return this.bodyAnalysisService.completeAnalysis(user.sub);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest body analysis and workout plan for current user' })
  @ApiResponse({ status: 200, description: 'Analysis retrieved successfully' })
  async getLatestAnalysis(@CurrentUser() user: any) {
    return this.bodyAnalysisService.getLatestAnalysis(user.sub);
  }

  @Get('photos')
  @ApiOperation({ summary: 'Get all uploaded photos with validation status' })
  async getUserPhotos(@CurrentUser() user: any) {
    return this.bodyAnalysisService.getUserPhotos(user.sub);
  }

  @Get(':userId/latest')
  @ApiOperation({ summary: 'Get latest analysis for a specific user (admin)' })
  async getLatestAnalysisByUserId(@Param('userId') userId: string) {
    return this.bodyAnalysisService.getLatestAnalysis(userId);
  }

  @Delete('photo/:photoType')
  @ApiOperation({ summary: 'Delete a specific body photo' })
  async deletePhoto(
    @CurrentUser() user: any,
    @Param('photoType') photoType: string,
  ) {
    if (!Object.values(PhotoType).includes(photoType as PhotoType)) {
      throw new BadRequestException(`Invalid photo type: ${photoType}`);
    }
    await this.bodyAnalysisService.deletePhoto(user.sub, photoType as PhotoType);
    return { message: `Photo ${photoType} deleted successfully` };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get full body analysis history for the current user' })
  @ApiResponse({ status: 200, description: 'Analysis history retrieved successfully' })
  async getAnalysisHistory(@CurrentUser() user: any) {
    return this.bodyAnalysisService.getAnalysisHistory(user.sub);
  }

  @Post('compare')
  @ApiOperation({ summary: 'AI comparison of first vs latest body analysis' })
  @ApiResponse({ status: 200, description: 'Comparison generated successfully' })
  async compareLatestTwo(@CurrentUser() user: any) {
    return this.bodyAnalysisService.compareLatestTwo(user.sub);
  }
}
