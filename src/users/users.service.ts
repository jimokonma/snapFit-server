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

  private getPhotoTypeFromIndex(index: number): 'front' | 'back' | 'left' | 'fullBody' {
    const types: ('front' | 'back' | 'left' | 'fullBody')[] = ['front', 'back', 'left', 'fullBody'];
    return types[index];
  }

  async uploadBodyPhoto(userId: string, photoUrl: string, photoType: 'front' | 'back' | 'left' | 'fullBody'): Promise<User> {
    const user = await this.findById(userId);
    const bodyPhotos = user.bodyPhotos || {};
    bodyPhotos[photoType] = photoUrl;
    return this.updateProfile(userId, { bodyPhotos });
  }

  async uploadEquipmentPhotos(userId: string, photoUrls: string[]): Promise<User> {
    return this.updateProfile(userId, { equipmentPhotos: photoUrls });
  }

  async completeOnboarding(userId: string, onboardingData: {
    age: number;
    height: number;
    weight: number;
    fitnessGoal: string;
    experienceLevel: string;
    workoutHistory: string;
    bodyPhotos: { front?: string; back?: string; left?: string; fullBody?: string };
    equipmentPhotos: string[];
    selectedEquipment: string[];
  }): Promise<User> {
    return this.updateProfile(userId, {
      age: onboardingData.age,
      height: onboardingData.height,
      weight: onboardingData.weight,
      fitnessGoal: onboardingData.fitnessGoal as any,
      experienceLevel: onboardingData.experienceLevel as any,
      workoutHistory: onboardingData.workoutHistory as any,
      bodyPhotos: onboardingData.bodyPhotos,
      equipmentPhotos: onboardingData.equipmentPhotos,
      selectedEquipment: onboardingData.selectedEquipment,
      onboardingCompleted: true,
      onboardingProgress: {
        profileInfoCompleted: true,
        fitnessGoalCompleted: true,
        bodyPhotosCompleted: true,
        equipmentPhotosCompleted: true,
        currentStep: 4,
      },
    });
  }

  async updateSelectedEquipment(userId: string, equipment: string[]): Promise<User> {
    return this.updateProfile(userId, { selectedEquipment: equipment });
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

  async getWorkoutFoundation(userId: string): Promise<any> {
    const user = await this.findById(userId);
    if (!user.workoutFoundation) {
      throw new NotFoundException('Workout foundation not found. Please complete body photo analysis first.');
    }
    return user.workoutFoundation;
  }
}
