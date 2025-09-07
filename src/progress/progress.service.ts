import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from '../common/schemas/progress.schema';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    private aiService: AiService,
  ) {}

  async createProgress(
    userId: string,
    photoUrl: string,
    weight?: number,
    notes?: string,
  ): Promise<Progress> {
    // Analyze the progress photo
    const aiAnalysis = await this.aiService.analyzeBodyPhoto(photoUrl);

    // Get the previous progress for comparison
    const previousProgress = await this.getLatestProgress(userId);

    const progress = new this.progressModel({
      userId: new Types.ObjectId(userId),
      photoUrl,
      weight,
      aiAnalysis,
      notes,
      isBaseline: !previousProgress,
      previousProgressId: previousProgress ? previousProgress._id : undefined,
    });

    return progress.save();
  }

  async getUserProgress(userId: string): Promise<Progress[]> {
    return this.progressModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
  }

  async getLatestProgress(userId: string): Promise<ProgressDocument | null> {
    return this.progressModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
  }

  async getProgressById(progressId: string, userId: string): Promise<Progress> {
    const progress = await this.progressModel.findOne({
      _id: new Types.ObjectId(progressId),
      userId: new Types.ObjectId(userId),
    });

    if (!progress) {
      throw new NotFoundException('Progress not found');
    }

    return progress;
  }

  async updateProgress(
    progressId: string,
    userId: string,
    updateData: Partial<Progress>,
  ): Promise<Progress> {
    const progress = await this.progressModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(progressId),
        userId: new Types.ObjectId(userId),
      },
      updateData,
      { new: true }
    );

    if (!progress) {
      throw new NotFoundException('Progress not found');
    }

    return progress;
  }

  async deleteProgress(progressId: string, userId: string): Promise<void> {
    const result = await this.progressModel.findOneAndDelete({
      _id: new Types.ObjectId(progressId),
      userId: new Types.ObjectId(userId),
    });

    if (!result) {
      throw new NotFoundException('Progress not found');
    }
  }
}
