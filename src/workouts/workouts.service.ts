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
    
    // Check if user has completed onboarding with body photos and equipment selection
    if (!user.bodyPhotos || !user.selectedEquipment || user.selectedEquipment.length === 0) {
      throw new ForbiddenException('Please complete onboarding with body photos and equipment selection first');
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
    
    // Use selected equipment names instead of analyzing photos
    const equipmentList = user.selectedEquipment;

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

  async generateWorkoutMedia(workoutId: string, type: 'image' | 'video', forceRegenerate: boolean, userId: string): Promise<any> {
    const workout = await this.getWorkoutById(workoutId, userId);
    
    // Check if user has remaining instructions
    const user = await this.usersService.findById(userId);
    const isFreeTrialActive = await this.usersService.isFreeTrialActive(userId);
    
    if (isFreeTrialActive) {
      const remaining = await this.usersService.getFreeTrialInstructionsRemaining(userId);
      if (remaining <= 0) {
        throw new ForbiddenException('No free trial instructions remaining');
      }
    }

    const results = [];
    let totalExercises = 0;
    let processedExercises = 0;

    // Count total exercises
    workout.days.forEach(day => {
      if (!day.isRestDay) {
        totalExercises += day.exercises.length;
      }
    });

    // Process each exercise
    for (const day of workout.days) {
      if (day.isRestDay) continue;

      for (let i = 0; i < day.exercises.length; i++) {
        const exercise = day.exercises[i];
        
        // Skip if media already exists and not forcing regeneration
        if (!forceRegenerate && 
            (type === 'image' ? exercise.instructionImageUrl : exercise.instructionVideoUrl)) {
          processedExercises++;
          continue;
        }

        try {
          // Generate media for this exercise
          const mediaUrl = await this.aiService.generateExerciseMedia(exercise.name, type);
          
          // Update the exercise with the media URL
          if (type === 'image') {
            exercise.instructionImageUrl = mediaUrl;
          } else {
            exercise.instructionVideoUrl = mediaUrl;
          }

          // Increment free trial usage if applicable
          if (isFreeTrialActive) {
            await this.usersService.incrementFreeTrialInstructions(userId);
          }

          results.push({
            exerciseName: exercise.name,
            dayNumber: day.dayNumber,
            exerciseIndex: i,
            mediaUrl,
            type
          });

          processedExercises++;
        } catch (error) {
          console.error(`Failed to generate ${type} for exercise ${exercise.name}:`, error);
          results.push({
            exerciseName: exercise.name,
            dayNumber: day.dayNumber,
            exerciseIndex: i,
            error: error.message,
            type
          });
        }
      }
    }

    // Save the updated workout
    await workout.save();

    return {
      success: true,
      message: `Generated ${type}s for ${processedExercises}/${totalExercises} exercises`,
      results,
      totalExercises,
      processedExercises,
      skippedExercises: totalExercises - processedExercises
    };
  }

  async generateExerciseMedia(
    exerciseId: string, 
    type: 'image' | 'video', 
    userId: string
  ): Promise<any> {
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

    // Find the workout and exercise by exercise ID
    const workout = await this.workoutModel.findOne({
      'days.exercises._id': exerciseId,
      userId: new Types.ObjectId(userId)
    });

    if (!workout) {
      throw new NotFoundException('Exercise not found or you do not have access to this exercise');
    }

    // Find the specific exercise
    let foundExercise = null;
    let foundDay = null;
    let exerciseIndex = -1;

    for (const day of workout.days) {
      if (day.isRestDay) continue;
      
      for (let i = 0; i < day.exercises.length; i++) {
        if (day.exercises[i]._id.toString() === exerciseId) {
          foundExercise = day.exercises[i];
          foundDay = day;
          exerciseIndex = i;
          break;
        }
      }
      if (foundExercise) break;
    }

    if (!foundExercise) {
      throw new NotFoundException('Exercise not found');
    }

    if (foundDay.isRestDay) {
      throw new BadRequestException('Cannot generate media for rest day');
    }

    try {
      // Generate media for this specific exercise
      const mediaUrl = await this.aiService.generateExerciseMedia(foundExercise.name, type);
      
      // Update the exercise with the media URL
      if (type === 'image') {
        foundExercise.instructionImageUrl = mediaUrl;
      } else {
        foundExercise.instructionVideoUrl = mediaUrl;
      }

      // Save the updated workout
      await workout.save();

      return {
        success: true,
        message: `${type} generated successfully for ${foundExercise.name}`,
        exerciseName: foundExercise.name,
        exerciseId: foundExercise._id,
        dayNumber: foundDay.dayNumber,
        dayName: foundDay.dayName,
        exerciseIndex,
        mediaUrl,
        type
      };
    } catch (error) {
      throw new Error(`Failed to generate ${type} for exercise ${foundExercise.name}: ${error.message}`);
    }
  }
}
