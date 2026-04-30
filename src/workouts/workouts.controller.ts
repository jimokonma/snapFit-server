import { Controller, Get, Post, Body, UseGuards, Request, Param, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  GenerateInstructionsDto,
  GenerateWorkoutOptionsDto,
  ExerciseProgressDto,
} from '../common/dto/workout.dto';

@ApiTags('Workouts')
@Controller('workouts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate new workout plan with options' })
  @ApiResponse({ status: 201, description: 'Workout plan generated successfully' })
  async generateWorkoutPlan(@Request() req, @Body() options: GenerateWorkoutOptionsDto) {
    return this.workoutsService.generateWorkoutPlan(req.user.sub, options);
  }

  @Get()
  @ApiOperation({ summary: 'Get user workout plans' })
  async getUserWorkouts(@Request() req) {
    return this.workoutsService.getUserWorkouts(req.user.sub);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get most recent workout plan' })
  async getCurrentWorkout(@Request() req) {
    return this.workoutsService.getCurrentWorkout(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific workout plan' })
  async getWorkoutById(@Request() req, @Param('id') workoutId: string) {
    return this.workoutsService.getWorkoutById(workoutId, req.user.sub);
  }

  @Put(':id/progress')
  @ApiOperation({ summary: 'Update workout-level progress' })
  async updateWorkoutProgress(@Request() req, @Param('id') workoutId: string, @Body() progressData: any) {
    return this.workoutsService.updateWorkoutProgress(workoutId, req.user.sub, progressData);
  }

  @Put(':id/exercise-progress')
  @ApiOperation({ summary: 'Save done/skipped status for a specific exercise' })
  @ApiResponse({ status: 200, description: 'Exercise progress saved' })
  async saveExerciseProgress(
    @Request() req,
    @Param('id') workoutId: string,
    @Body() dto: ExerciseProgressDto,
  ) {
    return this.workoutsService.saveExerciseProgress(
      workoutId,
      req.user.sub,
      dto.dayNumber,
      dto.exerciseIndex,
      dto.status,
    );
  }

  @Post('exercise/:exerciseId/image')
  @ApiOperation({ summary: 'Generate DALL-E 3 instructional image for an exercise' })
  async generateExerciseImage(@Request() req, @Param('exerciseId') exerciseId: string) {
    return this.workoutsService.generateExerciseImage(exerciseId, req.user.sub);
  }

  @Post('exercise/:exerciseId/video')
  @ApiOperation({ summary: 'Generate AI instructional video for an exercise via Replicate' })
  async generateExerciseVideo(@Request() req, @Param('exerciseId') exerciseId: string) {
    return this.workoutsService.generateExerciseVideo(exerciseId, req.user.sub);
  }

  @Post('exercise/:exerciseId/home')
  @ApiOperation({ summary: 'Convert exercise to bodyweight home workout variant' })
  async convertExerciseToHome(@Request() req, @Param('exerciseId') exerciseId: string) {
    return this.workoutsService.convertExerciseToHome(exerciseId, req.user.sub);
  }

  @Post(':id/instructions')
  @ApiOperation({ summary: 'Generate exercise instructions' })
  async generateExerciseInstructions(
    @Request() req,
    @Param('id') workoutId: string,
    @Body() dto: GenerateInstructionsDto,
  ) {
    return this.workoutsService.generateExerciseInstructions(workoutId, dto.exerciseName, dto.type, req.user.sub);
  }
}
