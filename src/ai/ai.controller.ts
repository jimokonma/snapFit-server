import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
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

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI fitness coach' })
  @ApiResponse({ status: 200, description: 'AI response generated' })
  async chat(
    @Request() req,
    @Body() body: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      userContext?: string;
    },
  ) {
    if (!body.messages?.length) throw new BadRequestException('messages are required');
    return { response: await this.aiService.chat(body.messages, body.userContext, req.user.sub) };
  }

  @Get('chat-history')
  @ApiOperation({ summary: 'Get saved AI chat history' })
  @ApiResponse({ status: 200, description: 'Chat history retrieved' })
  async getChatHistory(@Request() req) {
    const history = await this.aiService.getChatHistory(req.user.sub);
    return { messages: history };
  }

  @Delete('chat-history')
  @ApiOperation({ summary: 'Clear AI chat history' })
  @ApiResponse({ status: 200, description: 'Chat history cleared' })
  async clearChatHistory(@Request() req) {
    await this.aiService.clearChatHistory(req.user.sub);
    return { message: 'Chat history cleared' };
  }

  @Post('chat-with-image')
  @ApiOperation({ summary: 'Chat with AI using an image (Elite only)' })
  @ApiResponse({ status: 200, description: 'AI response to image' })
  async chatWithImage(
    @Request() req,
    @Body() body: {
      imageBase64: string;
      mediaType?: string;
      message?: string;
      userContext?: string;
    },
  ) {
    if (!body.imageBase64) throw new BadRequestException('imageBase64 is required');
    const mediaType = (body.mediaType as any) || 'image/jpeg';
    return {
      response: await this.aiService.chatWithImage(
        body.imageBase64,
        mediaType,
        body.message || '',
        body.userContext,
        req.user.sub,
      ),
    };
  }

  @Post('generate-image')
  @ApiOperation({ summary: 'Generate a fitness image (Elite only)' })
  @ApiResponse({ status: 200, description: 'Generated image URL and caption' })
  async generateImage(
    @Request() req,
    @Body() body: { prompt: string },
  ) {
    if (!body.prompt) throw new BadRequestException('prompt is required');
    return this.aiService.generateChatImage(body.prompt, req.user.sub);
  }

  @Post('generate-video')
  @ApiOperation({ summary: 'Start async video generation (Elite only)' })
  @ApiResponse({ status: 200, description: 'Job ID for polling' })
  async generateVideo(
    @Request() req,
    @Body() body: { prompt: string },
  ) {
    if (!body.prompt) throw new BadRequestException('prompt is required');
    const jobId = await this.aiService.startVideoGeneration(body.prompt, req.user.sub);
    return { jobId };
  }

  @Get('video-status/:jobId')
  @ApiOperation({ summary: 'Poll video generation job status' })
  @ApiResponse({ status: 200, description: 'Job status and video URL when done' })
  async getVideoStatus(@Param('jobId') jobId: string) {
    return this.aiService.getVideoJobStatus(jobId);
  }
}
