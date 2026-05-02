import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workout, WorkoutDocument } from '../common/schemas/workout.schema';
import { AiService } from '../ai/ai.service';
import { UsersService } from '../users/users.service';
import { MediaService } from '../media/media.service';
import { CreateWorkoutDto } from '../common/dto/workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectModel(Workout.name) private workoutModel: Model<WorkoutDocument>,
    private aiService: AiService,
    private usersService: UsersService,
    private mediaService: MediaService,
  ) {}

  async generateWorkoutPlan(userId: string, options: { homeWorkout?: boolean; includeImages?: boolean; includeVideos?: boolean } = {}): Promise<Workout> {
    const user = await this.usersService.findById(userId);

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

    const workoutData = await this.aiService.generateWorkoutPlanWithOptions(userProfile, bodyAnalysis, {
      homeWorkout: options.homeWorkout,
    });

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

  async getCurrentWorkout(userId: string): Promise<WorkoutDocument | null> {
    return this.workoutModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
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

  async saveExerciseProgress(
    workoutId: string,
    userId: string,
    dayNumber: number,
    exerciseIndex: number,
    status: 'done' | 'skipped' | 'pending',
  ): Promise<WorkoutDocument> {
    const workout = await this.getWorkoutById(workoutId, userId);

    const day = workout.days.find(d => d.dayNumber === dayNumber);
    if (!day) throw new NotFoundException(`Day ${dayNumber} not found in workout`);

    const exercise = day.exercises[exerciseIndex];
    if (!exercise) throw new NotFoundException(`Exercise at index ${exerciseIndex} not found`);

    const previousStatus = (exercise as any).status;
    (exercise as any).status = status;

    // Award aura points only when transitioning to 'done'
    if (status === 'done' && previousStatus !== 'done') {
      let pointsToAward = 50;
      const dayFullyComplete =
        day.exercises.length > 0 &&
        day.exercises.every((e: any) => e.status === 'done');
      if (dayFullyComplete) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const anotherDayCompletedToday = workout.days.some(d => {
          if (d === day) return false;
          const completedAt = (d as any).completedAt as Date | undefined;
          if (!completedAt) return false;
          const c = new Date(completedAt);
          c.setHours(0, 0, 0, 0);
          return c.getTime() === today.getTime();
        });
        if (!anotherDayCompletedToday) pointsToAward += 200;
        (day as any).completedAt = new Date();
      }
      await this.usersService.addAuraPoints(userId, pointsToAward);
    }

    const allExercises = workout.days.flatMap(d => d.exercises);
    const done = allExercises.filter(e => (e as any).status === 'done').length;
    const skipped = allExercises.filter(e => (e as any).status === 'skipped').length;
    const total = allExercises.length;

    if (total > 0) {
      workout.completionPercentage = Math.round(((done + skipped) / total) * 100);
      workout.isCompleted = done + skipped === total;
    }

    return workout.save();
  }

  private findExerciseById(workout: WorkoutDocument, exerciseId: string) {
    for (const day of workout.days) {
      const exercise = (day.exercises as any).id(exerciseId);
      if (exercise) return { exercise, day };
    }
    return null;
  }

  async generateExerciseImage(exerciseId: string, userId: string): Promise<WorkoutDocument> {
    const workouts = await this.workoutModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(1);
    const workout = workouts[0];
    if (!workout) throw new NotFoundException('No workout found');

    const found = this.findExerciseById(workout, exerciseId);
    if (!found) throw new NotFoundException('Exercise not found');

    const { exercise } = found;
    const temporaryUrl = await this.aiService.generateExerciseImage(exercise.name, (exercise as any).category, (exercise as any).instructions);

    // Upload to Cloudinary for permanent storage; fall back to DALL-E URL if not configured
    try {
      exercise.instructionImageUrl = await this.mediaService.uploadFromUrl(temporaryUrl, 'snapfit/exercises');
    } catch {
      exercise.instructionImageUrl = temporaryUrl;
    }

    return workout.save();
  }

  async generateExerciseVideo(exerciseId: string, userId: string): Promise<WorkoutDocument> {
    const workouts = await this.workoutModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(1);
    const workout = workouts[0];
    if (!workout) throw new NotFoundException('No workout found');

    const found = this.findExerciseById(workout, exerciseId);
    if (!found) throw new NotFoundException('Exercise not found');

    // Mark as processing and return immediately so the request doesn't time out
    (found.exercise as any).videoGenerationStatus = 'processing';
    const saved = await workout.save();

    // Run generation in background — does not block the HTTP response
    this.runVideoGenerationInBackground(workout._id.toString(), exerciseId).catch(err =>
      console.error('Background video generation error:', err),
    );

    return saved;
  }

  private async runVideoGenerationInBackground(workoutId: string, exerciseId: string): Promise<void> {
    try {
      const workout = await this.workoutModel.findById(workoutId);
      if (!workout) return;

      const found = this.findExerciseById(workout, exerciseId);
      if (!found) return;

      const videoUrl = await this.aiService.generateExerciseVideo({
        name: found.exercise.name,
        category: (found.exercise as any).category,
        sets: found.exercise.sets,
        reps: found.exercise.reps,
        description: (found.exercise as any).description,
        instructions: (found.exercise as any).instructions,
        tips: (found.exercise as any).tips,
        notes: found.exercise.notes,
      });
      (found.exercise as any).instructionVideoUrl = videoUrl;
      (found.exercise as any).videoGenerationStatus = 'ready';
      await workout.save();
    } catch {
      try {
        const workout = await this.workoutModel.findById(workoutId);
        if (!workout) return;
        const found = this.findExerciseById(workout, exerciseId);
        if (found) {
          (found.exercise as any).videoGenerationStatus = 'failed';
          await workout.save();
        }
      } catch { /* ignore secondary failure */ }
    }
  }

  async convertExerciseToHome(exerciseId: string, userId: string): Promise<WorkoutDocument> {
    const workouts = await this.workoutModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(1);
    const workout = workouts[0];
    if (!workout) throw new NotFoundException('No workout found');

    const found = this.findExerciseById(workout, exerciseId);
    if (!found) throw new NotFoundException('Exercise not found');

    const { exercise } = found;
    const homeVariant = await this.aiService.convertExerciseToHome({
      name: exercise.name,
      sets: exercise.sets,
      reps: String(exercise.reps),
      notes: exercise.notes,
    });

    exercise.homeVariantInstructions = `${homeVariant.name}\n\n${homeVariant.homeInstructions}\n\nEquipment: ${homeVariant.equipmentAlternative}`;
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

    return { exerciseName, type, instructions };
  }
}
