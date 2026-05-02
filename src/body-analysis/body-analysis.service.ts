import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BodyAnalysis, BodyAnalysisDocument, PhotoType } from '../common/schemas/body-analysis.schema';
import { BodyAnalysisRecord, BodyAnalysisRecordDocument } from '../common/schemas/body-analysis-record.schema';
import { MediaService } from '../media/media.service';
import { AiService, PhotoValidationResult } from '../ai/ai.service';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Workout, WorkoutDocument } from '../common/schemas/workout.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class BodyAnalysisService {
  private readonly logger = new Logger(BodyAnalysisService.name);

  constructor(
    @InjectModel(BodyAnalysis.name) private bodyAnalysisModel: Model<BodyAnalysisDocument>,
    @InjectModel(BodyAnalysisRecord.name) private bodyAnalysisRecordModel: Model<BodyAnalysisRecordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Workout.name) private workoutModel: Model<WorkoutDocument>,
    private mediaService: MediaService,
    private aiService: AiService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  /** Returns cloudinaryPublicId for new docs, or the legacy imageUrl string for old docs. */
  private getPhotoId(doc: any): string | undefined {
    return doc.cloudinaryPublicId || doc.imageUrl;
  }

  /**
   * Upload a single body photo as a private Cloudinary asset,
   * run Claude validation immediately, and return a short-lived signed URL.
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
    const { publicId, signedUrl } = await Promise.race([
      this.mediaService.uploadImagePrivate(file, folder),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Image upload timeout')), 30000),
      ),
    ]);

    // Validate photo via AI using a short-lived signed URL (Claude fetches from Cloudinary)
    const validation = await this.aiService.validatePhoto(signedUrl, photoType as any);

    const existing = await this.bodyAnalysisModel.findOne({ userId, photoType });
    if (existing) {
      await this.bodyAnalysisModel.findByIdAndUpdate(existing._id, {
        cloudinaryPublicId: publicId,
        validationPassed: validation.passed,
        validationIssues: validation.issues,
        validationFeedback: validation.feedback,
      });
    } else {
      await this.bodyAnalysisModel.create({
        userId,
        photoType,
        cloudinaryPublicId: publicId,
        validationPassed: validation.passed,
        validationIssues: validation.issues,
        validationFeedback: validation.feedback,
      });
    }

    // Return a fresh signed URL to the client (expires in 1 hour)
    return { imageUrl: signedUrl, validation };
  }

  /**
   * Complete analysis: analyze all 4 photos + generate 7-day plan.
   * Saves a BodyAnalysisRecord to the history collection for comparison later.
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

    // Check quota before starting AI work (but don't consume yet — only consume on success)
    await this.subscriptionsService.checkQuota(userId, 'bodyAnalysis');

    // Generate signed URLs for AI (handles both new public_ids and legacy full URLs)
    const photoUrls = requiredTypes.map((t) =>
      this.mediaService.generateSignedUrl(this.getPhotoId(byType[t])),
    );

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
        setTimeout(() => reject(new Error('Workout generation timeout')), 60000),
      ),
    ]);

    // AI succeeded — consume the quota now
    await this.subscriptionsService.consumeQuota(userId, 'bodyAnalysis');

    const savedWorkout = await this.workoutModel.create({
      userId: new Types.ObjectId(userId),
      title: workoutPlan.title || '7-Day Starter Plan',
      description: workoutPlan.description || '',
      days: workoutPlan.days || [],
      weekNumber: 1,
      aiAnalysis: bodyAnalysis.overallAssessment,
    });

    const updatedFields: any = {
      bodyAnalysis: { ...bodyAnalysis, analyzedAt: new Date() },
      bodyAnalysisStatus: 'completed',
      'onboarding.bodyAnalysis': true,
    };

    const allStagesDone = onboarding.profileInfo && onboarding.fitnessGoal;
    if (allStagesDone && !user.onboardingCompleted) {
      updatedFields.onboardingCompleted = true;
    }

    await this.userModel.findByIdAndUpdate(userId, updatedFields);

    // Save to analysis history collection for before/after comparison
    const existingCount = await this.bodyAnalysisRecordModel.countDocuments({
      userId: new Types.ObjectId(userId),
    });
    await this.bodyAnalysisRecordModel.create({
      userId: new Types.ObjectId(userId),
      analysisNumber: existingCount + 1,
      photoUrls: {
        upper_front: this.getPhotoId(byType[PhotoType.UPPER_FRONT]),
        upper_back: this.getPhotoId(byType[PhotoType.UPPER_BACK]),
        side_profile: this.getPhotoId(byType[PhotoType.SIDE_PROFILE]),
        full_body: this.getPhotoId(byType[PhotoType.FULL_BODY]),
      },
      analysis: bodyAnalysis,
    });

    this.logger.log(`Analysis #${existingCount + 1} saved for user ${userId}`);

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
    return { bodyAnalysis: user.bodyAnalysis, workoutPlan: latestWorkout || null };
  }

  async getUserPhotos(userId: string): Promise<any[]> {
    const docs = await this.bodyAnalysisModel.find({ userId }).sort({ createdAt: -1 });
    return docs.map((doc) => ({
      ...(doc.toObject ? doc.toObject() : doc),
      imageUrl: this.mediaService.generateSignedUrl(this.getPhotoId(doc)),
      cloudinaryPublicId: undefined,
    }));
  }

  async deletePhoto(userId: string, photoType: PhotoType): Promise<void> {
    const analysis = await this.bodyAnalysisModel.findOne({ userId, photoType });
    if (!analysis) throw new NotFoundException(`Photo of type ${photoType} not found`);
    try {
      const photoId = this.getPhotoId(analysis);
      if (photoId) await this.mediaService.deleteMedia(photoId);
    } catch (err: any) {
      this.logger.warn(`Failed to delete from Cloudinary: ${err?.message}`);
    }
    await this.bodyAnalysisModel.findByIdAndDelete(analysis._id);
  }

  async getAnalysisHistory(userId: string): Promise<any[]> {
    const records = await this.bodyAnalysisRecordModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ analysisNumber: 1 });

    // photoUrls stores public_ids (decrypted by plugin); convert to signed URLs for the client
    return records.map((record) => {
      const obj: any = record.toObject ? record.toObject() : { ...record };
      if (obj.photoUrls) {
        const signed: Record<string, string> = {};
        for (const [key, publicId] of Object.entries(obj.photoUrls as Record<string, string>)) {
          if (publicId) signed[key] = this.mediaService.generateSignedUrl(publicId);
        }
        obj.photoUrls = signed;
      }
      return obj;
    });
  }

  async compareLatestTwo(userId: string): Promise<{
    score: number;
    headline: string;
    summary: string;
    improvements: string[];
    stillWorkingOn: string[];
    firstRecord: BodyAnalysisRecordDocument;
    latestRecord: BodyAnalysisRecordDocument;
    daysBetween: number;
  }> {
    const records = await this.bodyAnalysisRecordModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ analysisNumber: 1 });

    if (records.length < 2) {
      throw new BadRequestException(
        'You need at least 2 body analyses to compare. Complete a re-analysis first.',
      );
    }

    const firstRecord = records[0];
    const latestRecord = records[records.length - 1];

    const daysBetween = Math.max(
      1,
      Math.round(
        (new Date((latestRecord as any).createdAt).getTime() -
          new Date((firstRecord as any).createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    const user = await this.userModel.findById(userId).select('fitnessGoal');
    const fitnessGoal = (user as any)?.fitnessGoal || 'general_fitness';

    const comparison = await this.aiService.compareBodyAnalyses(
      firstRecord.analysis as any,
      latestRecord.analysis as any,
      daysBetween,
      fitnessGoal,
    );

    return { ...comparison, firstRecord, latestRecord, daysBetween };
  }
}
