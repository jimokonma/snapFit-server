import { Controller, Get, Post, Body, UseGuards, Request, Param, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateInstructionsDto, GenerateWorkoutMediaDto, GenerateExerciseMediaDto } from '../common/dto/workout.dto';

@ApiTags('Workouts')
@Controller('workouts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate new workout plan' })
  @ApiResponse({ status: 201, description: 'Workout plan generated successfully' })
  async generateWorkoutPlan(@Request() req) {
    return this.workoutsService.generateWorkoutPlan(req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get user workout plans' })
  @ApiResponse({ status: 200, description: 'Workout plans retrieved successfully' })
  async getUserWorkouts(@Request() req) {
    return this.workoutsService.getUserWorkouts(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific workout plan' })
  @ApiResponse({ status: 200, description: 'Workout plan retrieved successfully' })
  async getWorkoutById(@Request() req, @Param('id') workoutId: string) {
    return this.workoutsService.getWorkoutById(workoutId, req.user.sub);
  }

  @Put(':id/progress')
  @ApiOperation({ summary: 'Update workout progress' })
  @ApiResponse({ status: 200, description: 'Workout progress updated successfully' })
  async updateWorkoutProgress(
    @Request() req,
    @Param('id') workoutId: string,
    @Body() progressData: any,
  ) {
    return this.workoutsService.updateWorkoutProgress(workoutId, req.user.sub, progressData);
  }

  @Post(':id/instructions')
  @ApiOperation({ summary: 'Generate exercise instructions' })
  @ApiResponse({ status: 200, description: 'Exercise instructions generated successfully' })
  async generateExerciseInstructions(
    @Request() req,
    @Param('id') workoutId: string,
    @Body() generateInstructionsDto: GenerateInstructionsDto,
  ) {
    return this.workoutsService.generateExerciseInstructions(
      workoutId,
      generateInstructionsDto.exerciseName,
      generateInstructionsDto.type,
      req.user.sub,
    );
  }

  @Post(':id/generate-media')
  @ApiOperation({ summary: 'Generate media for all exercises in workout' })
  @ApiResponse({ status: 200, description: 'Media generated for all exercises successfully' })
  async generateWorkoutMedia(
    @Request() req,
    @Param('id') workoutId: string,
    @Body() generateWorkoutMediaDto: GenerateWorkoutMediaDto,
  ) {
    return this.workoutsService.generateWorkoutMedia(
      workoutId,
      generateWorkoutMediaDto.type,
      generateWorkoutMediaDto.forceRegenerate || false,
      req.user.sub,
    );
  }

  @Post('exercise/:exerciseId/media')
  @ApiOperation({ summary: 'Generate media for specific exercise by exercise ID' })
  @ApiResponse({ status: 200, description: 'Exercise media generated successfully' })
  async generateExerciseMedia(
    @Request() req,
    @Param('exerciseId') exerciseId: string,
    @Body() generateExerciseMediaDto: GenerateExerciseMediaDto,
  ) {
    return this.workoutsService.generateExerciseMedia(
      exerciseId,
      generateExerciseMediaDto.type,
      req.user.sub,
    );
  }
}
