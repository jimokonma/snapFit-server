import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateInstructionsDto } from '../common/dto/workout.dto';

@ApiTags('AI Services')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze-body')
  @ApiOperation({ summary: 'Analyze body photo for workout planning' })
  @ApiResponse({ status: 200, description: 'Body analysis completed successfully' })
  async analyzeBodyPhoto(@Body() body: { imageUrl: string }) {
    return this.aiService.analyzeBodyPhoto(body.imageUrl);
  }

  @Post('analyze-equipment')
  @ApiOperation({ summary: 'Analyze equipment photo' })
  @ApiResponse({ status: 200, description: 'Equipment analysis completed successfully' })
  async analyzeEquipmentPhoto(@Body() body: { imageUrl: string }) {
    return this.aiService.analyzeEquipmentPhoto(body.imageUrl);
  }

  @Post('generate-instructions')
  @ApiOperation({ summary: 'Generate exercise instructions' })
  @ApiResponse({ status: 200, description: 'Instructions generated successfully' })
  async generateInstructions(@Body() generateInstructionsDto: GenerateInstructionsDto) {
    return this.aiService.generateExerciseInstructions(
      generateInstructionsDto.exerciseName,
      generateInstructionsDto.type,
    );
  }

  @Post('generate-instruction-image')
  @ApiOperation({ summary: 'Generate instruction image for exercise' })
  @ApiResponse({ status: 200, description: 'Instruction image generated successfully' })
  async generateInstructionImage(@Body() body: { exerciseName: string; instructionPrompt: string }) {
    return this.aiService.generateInstructionImage(body.exerciseName, body.instructionPrompt);
  }
}
