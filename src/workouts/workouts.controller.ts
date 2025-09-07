import { Controller, Get, Post, Body, UseGuards, Request, Param, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateInstructionsDto } from '../common/dto/workout.dto';

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
}
