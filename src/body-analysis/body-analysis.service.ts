import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BodyAnalysis, BodyAnalysisDocument, PhotoType } from '../common/schemas/body-analysis.schema';
import { ComprehensiveAnalysis, ComprehensiveAnalysisDocument } from '../common/schemas/comprehensive-analysis.schema';
import { MediaPipeService } from '../mediapipe/mediapipe.service';
import { MediaService } from '../media/media.service';
import { AiService } from '../ai/ai.service';
import { BodyAnalysisData, ComprehensiveBodyAnalysis } from '../ai/ai.service';
import { User, UserDocument } from '../common/schemas/user.schema';

@Injectable()
export class BodyAnalysisService {
  private readonly logger = new Logger(BodyAnalysisService.name);

  constructor(
    @InjectModel(BodyAnalysis.name) private bodyAnalysisModel: Model<BodyAnalysisDocument>,
    @InjectModel(ComprehensiveAnalysis.name) private comprehensiveAnalysisModel: Model<ComprehensiveAnalysisDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mediaPipeService: MediaPipeService,
    private mediaService: MediaService,
    private aiService: AiService,
  ) {}

  /**
   * Upload and process a single body photo with MediaPipe analysis
   */
  async uploadPhoto(
    userId: string,
    file: Express.Multer.File,
    photoType: PhotoType,
    preProcessedLandmarks?: any[]
  ): Promise<BodyAnalysisData> {
    try {
      // Validate photo type
      if (!Object.values(PhotoType).includes(photoType)) {
        throw new BadRequestException(`Invalid photo type: ${photoType}`);
      }

      // Validate file
      if (!file || !file.buffer) {
        throw new BadRequestException('Invalid file provided');
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only JPEG and PNG are allowed');
      }

    // Check if user already has this photo type
    const existing = await this.bodyAnalysisModel.findOne({ userId, photoType });
    if (existing) {
      this.logger.log(`Updating existing ${photoType} photo for user ${userId}`);
    }

      // Upload image to Cloudinary with timeout
      const folder = `snapfit/users/${userId}/body-photos`;
      const uploadTimeout = 30000; // 30 seconds
      const imageUrl = await Promise.race([
        this.mediaService.uploadImage(file, folder),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Image upload timeout')), uploadTimeout)
        ),
      ]);

      // Process with MediaPipe (accepts pre-processed landmarks from frontend)
      let bodyAnalysisData: BodyAnalysisData;
      try {
        if (preProcessedLandmarks && preProcessedLandmarks.length > 0) {
          bodyAnalysisData = await this.mediaPipeService.processPreComputedLandmarks(
            preProcessedLandmarks,
            photoType,
            imageUrl
          );
        } else {
          // If no landmarks provided, create minimal data structure
          // In production, landmarks should be processed on frontend
          this.logger.warn(`No landmarks provided for ${photoType}. Creating minimal analysis data.`);
          bodyAnalysisData = {
            photoType,
            landmarks: [],
            worldLandmarks: [],
            measurements: {},
            posture: {},
            symmetry: { symmetryScore: 0 },
            imageUrl,
            timestamp: new Date(),
            validationPassed: false,
            validationIssues: ['Landmarks not provided. Please process on frontend.'],
          };
        }
      } catch (mpError: any) {
        this.logger.error(`MediaPipe processing error for ${photoType}:`, mpError);
        throw new BadRequestException(
          `Failed to process photo with MediaPipe: ${mpError.message || 'Unknown error'}`
        );
      }

      // Save to database with timeout
      const dbTimeout = 10000; // 10 seconds
      const landmarkConfidenceAverage = bodyAnalysisData.landmarks.length > 0
        ? bodyAnalysisData.landmarks.reduce((sum, l) => sum + l.visibility, 0) / bodyAnalysisData.landmarks.length
        : 0;

      const bodyAnalysis = await Promise.race([
        existing
          ? this.bodyAnalysisModel.findByIdAndUpdate(
              existing._id,
              {
                imageUrl,
                landmarks: bodyAnalysisData.landmarks,
                worldLandmarks: bodyAnalysisData.worldLandmarks,
                measurements: bodyAnalysisData.measurements,
                posture: bodyAnalysisData.posture,
                symmetry: bodyAnalysisData.symmetry,
                validationPassed: bodyAnalysisData.validationPassed,
                validationIssues: bodyAnalysisData.validationIssues,
                landmarkConfidenceAverage,
              },
              { new: true }
            )
          : this.bodyAnalysisModel.create({
              userId,
              photoType,
              imageUrl,
              landmarks: bodyAnalysisData.landmarks,
              worldLandmarks: bodyAnalysisData.worldLandmarks,
              measurements: bodyAnalysisData.measurements,
              posture: bodyAnalysisData.posture,
              symmetry: bodyAnalysisData.symmetry,
              validationPassed: bodyAnalysisData.validationPassed,
              validationIssues: bodyAnalysisData.validationIssues,
              landmarkConfidenceAverage,
            }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database operation timeout')), dbTimeout)
        ),
      ]);

      return bodyAnalysisData;
    } catch (error: any) {
      this.logger.error(`Error uploading photo ${photoType} for user ${userId}:`, error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to upload photo: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Complete 6-photo analysis and generate comprehensive report
   */
  async completeAnalysis(userId: string): Promise<ComprehensiveBodyAnalysis> {
    try {
      // Validate user exists
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get all 6 photos for this user with timeout
      const queryTimeout = 5000; // 5 seconds
      const bodyAnalyses = await Promise.race([
        this.bodyAnalysisModel.find({ userId }).sort({ createdAt: -1 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), queryTimeout)
        ),
      ]);

      if (!bodyAnalyses || bodyAnalyses.length === 0) {
        throw new NotFoundException('No body photos found. Please upload photos first.');
      }

      // Convert to BodyAnalysisData format
      const bodyAnalysisData: BodyAnalysisData[] = bodyAnalyses.map(analysis => ({
        photoType: analysis.photoType as any,
        landmarks: analysis.landmarks as any,
        worldLandmarks: analysis.worldLandmarks as any,
        measurements: analysis.measurements || {},
        posture: analysis.posture || {},
        symmetry: analysis.symmetry || { symmetryScore: 0 },
        imageUrl: analysis.imageUrl,
        timestamp: (analysis as any).createdAt || new Date(),
        validationPassed: analysis.validationPassed,
        validationIssues: analysis.validationIssues || [],
      }));

      const userProfile = {
        age: user.age,
        height: user.height,
        weight: user.weight,
        fitnessGoal: user.fitnessGoal,
        experienceLevel: user.experienceLevel,
        workoutHistory: user.workoutHistory,
      };

      // Generate comprehensive analysis using AI service with timeout
      const aiTimeout = 60000; // 60 seconds for AI analysis
      const comprehensiveAnalysis = await Promise.race([
        this.aiService.analyzeBodyWithMediaPipe(bodyAnalysisData, userProfile),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout')), aiTimeout)
        ),
      ]);

      // Save comprehensive analysis with timeout
      const saveTimeout = 10000; // 10 seconds
      await Promise.race([
        this.comprehensiveAnalysisModel.create({
          userId: user._id,
          bodyAnalysisIds: bodyAnalyses.map(a => a._id),
          overallAssessment: comprehensiveAnalysis.overallAssessment,
          bodyComposition: comprehensiveAnalysis.bodyComposition,
          measurements: comprehensiveAnalysis.measurements,
          postureAnalysis: comprehensiveAnalysis.postureAnalysis,
          symmetryAnalysis: comprehensiveAnalysis.symmetryAnalysis,
          strengths: comprehensiveAnalysis.strengths,
          areasForImprovement: comprehensiveAnalysis.areasForImprovement,
          recommendations: comprehensiveAnalysis.recommendations,
          detailedDescription: comprehensiveAnalysis.detailedDescription,
          mediaPipeData: comprehensiveAnalysis.mediaPipeData,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Save operation timeout')), saveTimeout)
        ),
      ]);

      // Update user with comprehensive analysis
      await Promise.race([
        this.userModel.findByIdAndUpdate(userId, {
          bodyAnalysis: {
            overallAssessment: comprehensiveAnalysis.overallAssessment,
            bodyComposition: comprehensiveAnalysis.bodyComposition,
            strengths: comprehensiveAnalysis.strengths,
            areasForImprovement: comprehensiveAnalysis.areasForImprovement,
            recommendations: comprehensiveAnalysis.recommendations,
            detailedDescription: comprehensiveAnalysis.detailedDescription,
            analyzedAt: new Date(),
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('User update timeout')), saveTimeout)
        ),
      ]);

      this.logger.log(`Comprehensive analysis completed for user ${userId}`);

      return comprehensiveAnalysis;
    } catch (error: any) {
      this.logger.error(`Error completing analysis for user ${userId}:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to complete analysis: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Get latest comprehensive analysis for a user
   */
  async getLatestAnalysis(userId: string): Promise<ComprehensiveAnalysisDocument> {
    const analysis = await this.comprehensiveAnalysisModel
      .findOne({ userId })
      .sort({ createdAt: -1 })
      .populate('bodyAnalysisIds');

    if (!analysis) {
      throw new NotFoundException('No comprehensive analysis found. Please complete body photo analysis first.');
    }

    return analysis;
  }

  /**
   * Get all uploaded photos with validation status
   */
  async getUserPhotos(userId: string): Promise<BodyAnalysisDocument[]> {
    return this.bodyAnalysisModel.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Delete a specific photo
   */
  async deletePhoto(userId: string, photoType: PhotoType): Promise<void> {
    const analysis = await this.bodyAnalysisModel.findOne({ userId, photoType });
    if (!analysis) {
      throw new NotFoundException(`Photo of type ${photoType} not found`);
    }

    // Delete from Cloudinary
    try {
      await this.mediaService.deleteMedia(analysis.imageUrl);
    } catch (error) {
      this.logger.warn(`Failed to delete media from Cloudinary: ${error.message}`);
    }

    // Delete from database
    await this.bodyAnalysisModel.findByIdAndDelete(analysis._id);
  }
}

