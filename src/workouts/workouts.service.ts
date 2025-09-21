import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    
    if (!user.bodyPhotos || !user.equipmentPhotos || user.equipmentPhotos.length === 0) {
      throw new ForbiddenException('Please upload body and equipment photos first');
    }

    // Use stored body analysis if available, otherwise analyze photos
    let bodyAnalysis = user.bodyAnalysis;
    if (!bodyAnalysis) {
      // Fallback: analyze body photos if no stored analysis
      const primaryBodyPhoto = user.bodyPhotos.front || Object.values(user.bodyPhotos)[0];
      const analysisResult = await this.aiService.analyzeBodyPhoto(primaryBodyPhoto, {
        age: user.age,
        height: user.height,
        weight: user.weight,
        fitnessGoal: user.fitnessGoal,
        experienceLevel: user.experienceLevel,
        workoutHistory: user.workoutHistory
      });
      
      // Convert to the expected format
      bodyAnalysis = {
        ...analysisResult,
        analyzedAt: new Date(),
        analyzedFromPhoto: primaryBodyPhoto
      };
    }
    
    // Analyze equipment photos
    const equipmentList = await this.aiService.analyzeEquipmentPhoto(user.equipmentPhotos[0]);

    // Generate workout plan using stored analysis and foundation
    const workoutData = await this.aiService.generateWorkoutPlan(user, bodyAnalysis, equipmentList);

    // Create workout document
    const workout = new this.workoutModel({
      ...workoutData,
      userId: new Types.ObjectId(userId),
      aiAnalysis: typeof bodyAnalysis === 'string' ? bodyAnalysis : bodyAnalysis.detailedDescription,
      bodyAnalysisData: bodyAnalysis, // Store full analysis data
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
    
    // Update completion percentage or other progress data
    workout.completionPercentage = progressData.completionPercentage || 0;
    workout.isCompleted = progressData.isCompleted || false;

    return workout.save();
  }

  async generateExerciseInstructions(workoutId: string, exerciseName: string, type: 'image' | 'video', userId: string): Promise<any> {
    const workout = await this.getWorkoutById(workoutId, userId);
    
    // Check if user has remaining instructions
    const user = await this.usersService.findById(userId);
    const isFreeTrialActive = await this.usersService.isFreeTrialActive(userId);
    
    if (isFreeTrialActive) {
      const remaining = await this.usersService.getFreeTrialInstructionsRemaining(userId);
      if (remaining <= 0) {
        throw new ForbiddenException('No free trial instructions remaining');
      }
      await this.usersService.incrementFreeTrialInstructions(userId);
    }

    // Generate instructions
    const instructions = await this.aiService.generateExerciseInstructions(exerciseName, type);
    
    // Update workout instruction count
    workout.instructionsGenerated += 1;
    await workout.save();

    return {
      exerciseName,
      type,
      instructions,
    };
  }
}
