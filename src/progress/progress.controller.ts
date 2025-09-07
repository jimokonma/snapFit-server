import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Progress')
@Controller('progress')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  @ApiOperation({ summary: 'Create progress entry' })
  @ApiResponse({ status: 201, description: 'Progress entry created successfully' })
  async createProgress(
    @Request() req,
    @Body() body: { photoUrl: string; weight?: number; notes?: string },
  ) {
    return this.progressService.createProgress(
      req.user.sub,
      body.photoUrl,
      body.weight,
      body.notes,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get user progress history' })
  @ApiResponse({ status: 200, description: 'Progress history retrieved successfully' })
  async getUserProgress(@Request() req) {
    return this.progressService.getUserProgress(req.user.sub);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest progress entry' })
  @ApiResponse({ status: 200, description: 'Latest progress retrieved successfully' })
  async getLatestProgress(@Request() req) {
    return this.progressService.getLatestProgress(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific progress entry' })
  @ApiResponse({ status: 200, description: 'Progress entry retrieved successfully' })
  async getProgressById(@Request() req, @Param('id') progressId: string) {
    return this.progressService.getProgressById(progressId, req.user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update progress entry' })
  @ApiResponse({ status: 200, description: 'Progress entry updated successfully' })
  async updateProgress(
    @Request() req,
    @Param('id') progressId: string,
    @Body() updateData: any,
  ) {
    return this.progressService.updateProgress(progressId, req.user.sub, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete progress entry' })
  @ApiResponse({ status: 200, description: 'Progress entry deleted successfully' })
  async deleteProgress(@Request() req, @Param('id') progressId: string) {
    await this.progressService.deleteProgress(progressId, req.user.sub);
    return { message: 'Progress entry deleted successfully' };
  }
}
