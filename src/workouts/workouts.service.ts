import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workout, WorkoutDocument } from '../common/schemas/workout.schema';
import { AiService } from '../ai/ai.service';
import { UsersService } from '../users/users.service';
import { CreateWorkoutDto } from '../common/dto/workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectModel(Workout.name) private workoutModel: Model<WorkoutDocument>,
    private aiService: AiService,
    private usersService: UsersService,
  ) {}

  async generateWorkoutPlan(userId: string): Promise<Workout> {
    const user = await this.usersService.findById(userId);

    if (!user.bodyPhotos) {
      throw new ForbiddenException('Please complete onboarding with body photos first');
    }

    const bodyAnalysis = user.bodyAnalysis;
    if (!bodyAnalysis) {
      throw new ForbiddenException('Body analysis not found. Please complete the body photo analysis step first.');
    }

    const userProfile = {
      age: user.age,
      height: user.height,
      weight: user.weight,
      fitnessGoal: user.fitnessGoal,
      experienceLevel: user.experienceLevel,
      workoutHistory: user.workoutHistory,
      daysPerWeek: user.daysPerWeek,
      injuries: user.injuries,
    };

    const workoutData = await this.aiService.generateWorkoutPlan(userProfile, bodyAnalysis);

    const workout = new this.workoutModel({
      userId: new Types.ObjectId(userId),
      title: workoutData.title,
      description: workoutData.description,
      days: workoutData.days,
      weekNumber: 1,
      aiAnalysis: bodyAnalysis.overallAssessment,
    });

    return await workout.save();
  }

  async getUserWorkouts(userId: string): Promise<Workout[]> {
    return this.workoutModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async getWorkoutById(workoutId: string, userId: string): Promise<WorkoutDocument> {
    const workout = await this.workoutModel.findOne({
      _id: new Types.ObjectId(workoutId),
      userId: new Types.ObjectId(userId),
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return workout;
  }

  async updateWorkoutProgress(workoutId: string, userId: string, progressData: any): Promise<Workout> {
    const workout = await this.getWorkoutById(workoutId, userId);

    workout.completionPercentage = progressData.completionPercentage || 0;
    workout.isCompleted = progressData.isCompleted || false;

    return workout.save();
  }

  async generateExerciseInstructions(workoutId: string, exerciseName: string, type: 'image' | 'video', userId: string): Promise<any> {
    const workout = await this.getWorkoutById(workoutId, userId);

    const isFreeTrialActive = await this.usersService.isFreeTrialActive(userId);

    if (isFreeTrialActive) {
      const remaining = await this.usersService.getFreeTrialInstructionsRemaining(userId);
      if (remaining <= 0) {
        throw new ForbiddenException('No free trial instructions remaining');
      }
      await this.usersService.incrementFreeTrialInstructions(userId);
    }

    const instructions = await this.aiService.generateExerciseInstructions(exerciseName);

    workout.instructionsGenerated += 1;
    await workout.save();

    return {
      exerciseName,
      type,
      instructions,
    };
  }

  async generateWorkoutMedia(workoutId: string, type: 'image' | 'video', forceRegenerate: boolean, userId: string): Promise<any> {
    throw new BadRequestException('Media generation is no longer supported. Use exercise instructions instead.');
  }

  async generateExerciseMedia(exerciseId: string, type: 'image' | 'video', userId: string): Promise<any> {
    throw new BadRequestException('Media generation is no longer supported. Use exercise instructions instead.');
  }
}
