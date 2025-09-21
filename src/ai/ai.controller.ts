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
  async analyzeBodyPhoto(@Body() body: { imageUrl: string }, @Request() req) {
    // Get user profile for context
    const user = req.user;
    return this.aiService.analyzeBodyPhoto(body.imageUrl, {
      age: user.age,
      height: user.height,
      weight: user.weight,
      fitnessGoal: user.fitnessGoal,
      experienceLevel: user.experienceLevel,
      workoutHistory: user.workoutHistory
    });
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

  @Post('generate-workout-foundation')
  @ApiOperation({ summary: 'Generate personalized workout foundation based on body analysis' })
  @ApiResponse({ status: 200, description: 'Workout foundation generated successfully' })
  async generateWorkoutFoundation(@Body() body: { bodyAnalysis: any }, @Request() req) {
    const user = req.user;
    return this.aiService.generateWorkoutFoundation(user, body.bodyAnalysis);
  }

  @Post('test-body-analysis')
  @ApiOperation({ summary: 'Test body analysis with a sample image' })
  @ApiResponse({ status: 200, description: 'Test analysis completed' })
  async testBodyAnalysis(@Body() body: { imageUrl: string }) {
    console.log('=== TESTING BODY ANALYSIS ===');
    console.log('Image URL:', body.imageUrl);
    
    try {
      const result = await this.aiService.analyzeBodyPhoto(body.imageUrl, {
        age: 25,
        height: 175,
        weight: 70,
        fitnessGoal: 'muscle_gain',
        experienceLevel: 'beginner',
        workoutHistory: 'never'
      });
      
      console.log('Test Analysis Result:', result);
      return {
        success: true,
        result: result,
        message: 'Test analysis completed successfully'
      };
    } catch (error) {
      console.error('Test Analysis Error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Test analysis failed'
      };
    }
  }
}
