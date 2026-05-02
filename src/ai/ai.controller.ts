import { Controller, Post, Get, Delete, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
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
}
