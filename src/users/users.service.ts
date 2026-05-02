import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';
import { MediaService } from '../media/media.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mediaService: MediaService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email });
  }

  async updateProfile(userId: string, updateData: Partial<User>): Promise<User> {
    if (updateData.profilePicture) {
      const existing = await this.userModel.findById(userId).select('profilePicture');
      if (existing?.profilePicture) {
        const publicId = this.extractCloudinaryPublicId(existing.profilePicture);
        if (publicId) this.mediaService.deleteMedia(publicId).catch(() => {});
      }
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private extractCloudinaryPublicId(url: string): string | null {
    try {
      const uploadIdx = url.indexOf('/upload/');
      if (uploadIdx === -1) return null;
      let path = url.substring(uploadIdx + 8);
      // Skip past transformations/version to find the folder path
      const snapfitIdx = path.indexOf('snapfit/');
      if (snapfitIdx !== -1) path = path.substring(snapfitIdx);
      const dotIdx = path.lastIndexOf('.');
      return dotIdx !== -1 ? path.substring(0, dotIdx) : path;
    } catch {
      return null;
    }
  }

  async uploadBodyPhotos(userId: string, files: Express.Multer.File[]): Promise<User> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 4) {
      throw new BadRequestException('Maximum 4 body photos allowed');
    }

    const user = await this.findById(userId);
    const bodyPhotos = user.bodyPhotos || {};

    // Upload files to Cloudinary and map them to body photo types
    const uploadPromises = files.map(async (file, index) => {
      const photoType = this.getPhotoTypeFromIndex(index);
      const folder = `snapfit/users/${userId}/body-photos`;
      const url = await this.mediaService.uploadImage(file, folder);
      return { photoType, url };
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Update bodyPhotos object with new URLs
    uploadResults.forEach(({ photoType, url }) => {
      bodyPhotos[photoType] = url;
    });

    return this.updateProfile(userId, { bodyPhotos });
  }

  private getPhotoTypeFromIndex(index: number): 'upper_front' | 'upper_back' | 'side_profile' | 'full_body' {
    const types: ('upper_front' | 'upper_back' | 'side_profile' | 'full_body')[] = ['upper_front', 'upper_back', 'side_profile', 'full_body'];
    return types[index];
  }

  async completeOnboarding(userId: string, onboardingData: {
    age: number;
    height: number;
    weight: number;
    fitnessGoal: string;
    experienceLevel: string;
    workoutHistory: string;
    daysPerWeek?: number;
    injuries?: string;
    bodyPhotos: { upper_front?: string; upper_back?: string; side_profile?: string; full_body?: string };
  }): Promise<User> {
    return this.updateProfile(userId, {
      age: onboardingData.age,
      height: onboardingData.height,
      weight: onboardingData.weight,
      fitnessGoal: onboardingData.fitnessGoal as any,
      experienceLevel: onboardingData.experienceLevel as any,
      workoutHistory: onboardingData.workoutHistory as any,
      daysPerWeek: onboardingData.daysPerWeek,
      injuries: onboardingData.injuries,
      bodyPhotos: onboardingData.bodyPhotos,
      onboarding: {
        profileInfo: true,
        fitnessGoal: true,
        bodyAnalysis: false,
      },
    });
  }

  async incrementFreeTrialInstructions(userId: string): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { freeTrialInstructionsUsed: 1 } },
      { new: true }
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async isFreeTrialActive(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user.hasUsedFreeTrial) return false;

    const trialDays = parseInt(process.env.FREE_TRIAL_DAYS || '5');
    const trialEndDate = new Date(user.freeTrialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    return new Date() <= trialEndDate;
  }

  async getFreeTrialInstructionsRemaining(userId: string): Promise<number> {
    const user = await this.findById(userId);
    const freeTrialLimit = parseInt(process.env.FREE_TRIAL_INSTRUCTIONS || '1');
    return Math.max(0, freeTrialLimit - user.freeTrialInstructionsUsed);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userModel.find().select('-password -refreshToken');
  }

  async suspendUser(userId: string): Promise<User> {
    return this.updateProfile(userId, { isActive: false });
  }

  async activateUser(userId: string): Promise<User> {
    return this.updateProfile(userId, { isActive: true });
  }

  async deleteUser(userId: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(userId);
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  async getBodyAnalysis(userId: string): Promise<any> {
    const user = await this.findById(userId);
    if (!user.bodyAnalysis) {
      throw new NotFoundException('Body analysis not found. Please complete body photo upload first.');
    }
    return user.bodyAnalysis;
  }

  async addAuraPoints(userId: string, points: number): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      [{ $set: { auraPoints: { $max: [0, { $add: [{ $ifNull: ['$auraPoints', 0] }, points] }] } } }],
    );
  }

  async getLeaderboard(requestingUserId: string): Promise<{
    entries: Array<{ rank: number; userId: string; name: string; initials: string; auraPoints: number; profilePicture?: string }>;
    currentUserRank: number;
    totalAthletes: number;
  }> {
    const [topUsers, currentUser, totalAthletes] = await Promise.all([
      this.userModel
        .find({ onboardingCompleted: true })
        .select('firstName lastName auraPoints profilePicture')
        .sort({ auraPoints: -1 })
        .limit(20),
      this.userModel.findById(requestingUserId).select('auraPoints'),
      this.userModel.countDocuments({ onboardingCompleted: true }),
    ]);

    const userPoints: number = (currentUser as any)?.auraPoints ?? 0;
    const usersAhead = await this.userModel.countDocuments({
      onboardingCompleted: true,
      auraPoints: { $gt: userPoints },
    });
    const currentUserRank = usersAhead + 1;

    const entries = topUsers.map((user, index) => ({
      rank: index + 1,
      userId: (user as any)._id.toString(),
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      initials: `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase(),
      auraPoints: (user as any).auraPoints ?? 0,
      profilePicture: (user as any).profilePicture ?? undefined,
    }));

    return { entries, currentUserRank, totalAthletes: Math.max(totalAthletes, 1) };
  }

}
