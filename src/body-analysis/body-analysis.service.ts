import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BodyAnalysis, BodyAnalysisDocument, PhotoType } from '../common/schemas/body-analysis.schema';
import { MediaService } from '../media/media.service';
import { AiService, PhotoValidationResult } from '../ai/ai.service';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Workout, WorkoutDocument } from '../common/schemas/workout.schema';

@Injectable()
export class BodyAnalysisService {
  private readonly logger = new Logger(BodyAnalysisService.name);

  constructor(
    @InjectModel(BodyAnalysis.name) private bodyAnalysisModel: Model<BodyAnalysisDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Workout.name) private workoutModel: Model<WorkoutDocument>,
    private mediaService: MediaService,
    private aiService: AiService,
  ) {}

  /**
   * Upload a single body photo, run Claude validation immediately, return result.
   * Frontend shows the feedback before allowing the user to proceed to the next photo.
   */
  async uploadAndValidatePhoto(
    userId: string,
    file: Express.Multer.File,
    photoType: PhotoType,
  ): Promise<{ imageUrl: string; validation: PhotoValidationResult }> {
    if (!file?.buffer) throw new BadRequestException('Invalid file provided');

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG and PNG are allowed');
    }

    const folder = `snapfit/users/${userId}/body-photos`;
    const imageUrl = await Promise.race([
      this.mediaService.uploadImage(file, folder),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Image upload timeout')), 30000),
      ),
    ]);

    const validation = await this.aiService.validatePhoto(imageUrl, photoType as any);

    const existing = await this.bodyAnalysisModel.findOne({ userId, photoType });
    if (existing) {
      await this.bodyAnalysisModel.findByIdAndUpdate(existing._id, {
        imageUrl,
        validationPassed: validation.passed,
        validationIssues: validation.issues,
        validationFeedback: validation.feedback,
      });
    } else {
      await this.bodyAnalysisModel.create({
        userId,
        photoType,
        imageUrl,
        validationPassed: validation.passed,
        validationIssues: validation.issues,
        validationFeedback: validation.feedback,
      });
    }

    return { imageUrl, validation };
  }

  /**
   * Complete analysis: analyze all 4 photos + generate 7-day plan.
   * Called after all 4 photos pass validation.
   */
  async completeAnalysis(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const onboarding: any = user.onboarding || {};
    if (!onboarding.profileInfo || !onboarding.fitnessGoal) {
      const missing = [];
      if (!onboarding.profileInfo) missing.push('Profile Info');
      if (!onboarding.fitnessGoal) missing.push('Fitness Goal');
      throw new BadRequestException(
        `Please complete onboarding stages first. Missing: ${missing.join(', ')}`,
      );
    }

    const requiredTypes = Object.values(PhotoType);
    const bodyAnalyses = await this.bodyAnalysisModel.find({ userId }).sort({ createdAt: -1 });

    const byType: Record<string, any> = {};
    for (const a of bodyAnalyses) {
      if (!byType[a.photoType]) byType[a.photoType] = a;
    }

    const missing = requiredTypes.filter((t) => !byType[t]);
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required photos: ${missing.join(', ')}`);
    }

    const invalid = requiredTypes.filter((t) => byType[t] && byType[t].validationPassed === false);
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Some photos failed validation: ${invalid.join(', ')}. Please retake them.`,
      );
    }

    const photoUrls = requiredTypes.map((t) => byType[t].imageUrl);

    const userProfile = {
      age: user.age,
      height: user.height,
      weight: user.weight,
      gender: user.gender,
      fitnessGoal: user.fitnessGoal,
      experienceLevel: user.experienceLevel,
      workoutHistory: user.workoutHistory,
      daysPerWeek: (user as any).daysPerWeek,
      injuries: (user as any).injuries,
    };

    const bodyAnalysis = await Promise.race([
      this.aiService.analyzeBody(photoUrls, userProfile),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Body analysis timeout')), 90000),
      ),
    ]);

    const workoutPlan = await Promise.race([
      this.aiService.generateWorkoutPlan(userProfile, bodyAnalysis),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Workout generation timeout')), 90000),
      ),
    ]);

    // Save workout plan to its own collection (source of truth)
    const savedWorkout = await this.workoutModel.create({
      userId: new Types.ObjectId(userId),
      title: workoutPlan.title || '7-Day Starter Plan',
      description: workoutPlan.description || '',
      days: workoutPlan.days || [],
      weekNumber: 1,
      aiAnalysis: bodyAnalysis.overallAssessment,
    });

    const updatedFields: any = {
      bodyAnalysis: {
        ...bodyAnalysis,
        analyzedAt: new Date(),
      },
      bodyAnalysisStatus: 'completed',
      'onboarding.bodyAnalysis': true,
    };

    const allStagesDone = onboarding.profileInfo && onboarding.fitnessGoal;
    if (allStagesDone && !user.onboardingCompleted) {
      updatedFields.onboardingCompleted = true;
    }

    await this.userModel.findByIdAndUpdate(userId, updatedFields);

    this.logger.log(`Analysis completed for user ${userId}; workout saved as ${savedWorkout._id}`);

    return { bodyAnalysis, workoutPlan: savedWorkout };
  }

  async getLatestAnalysis(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.bodyAnalysis) {
      throw new NotFoundException('No analysis found. Please complete body photo analysis first.');
    }
    const latestWorkout = await this.workoutModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
    return {
      bodyAnalysis: user.bodyAnalysis,
      workoutPlan: latestWorkout || null,
    };
  }

  async getUserPhotos(userId: string): Promise<BodyAnalysisDocument[]> {
    return this.bodyAnalysisModel.find({ userId }).sort({ createdAt: -1 });
  }

  async deletePhoto(userId: string, photoType: PhotoType): Promise<void> {
    const analysis = await this.bodyAnalysisModel.findOne({ userId, photoType });
    if (!analysis) throw new NotFoundException(`Photo of type ${photoType} not found`);
    try {
      await this.mediaService.deleteMedia(analysis.imageUrl);
    } catch (err) {
      this.logger.warn(`Failed to delete from Cloudinary: ${err.message}`);
    }
    await this.bodyAnalysisModel.findByIdAndDelete(analysis._id);
  }
}
