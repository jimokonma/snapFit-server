import { Controller, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService, PhotoType } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI Services')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-instructions')
  @ApiOperation({ summary: 'Generate step-by-step exercise instructions' })
  @ApiResponse({ status: 200, description: 'Instructions generated successfully' })
  async generateInstructions(@Body() body: { exerciseName: string }) {
    if (!body.exerciseName) throw new BadRequestException('exerciseName is required');
    return { instructions: await this.aiService.generateExerciseInstructions(body.exerciseName) };
  }
}
