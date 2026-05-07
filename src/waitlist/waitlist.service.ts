import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Waitlist, WaitlistDocument } from './schemas/waitlist.schema';

export interface JoinWaitlistDto {
  email: string;
  name?: string;
  source?: string;
  referrer?: string;
}

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectModel(Waitlist.name)
    private readonly waitlistModel: Model<WaitlistDocument>,
  ) {}

  async join(dto: JoinWaitlistDto): Promise<{ position: number; message: string }> {
    const existing = await this.waitlistModel.findOne({
      email: dto.email.toLowerCase().trim(),
    });

    if (existing) {
      const position = await this.waitlistModel.countDocuments({
        createdAt: { $lte: existing['createdAt'] },
      });
      return {
        position,
        message: "You're already on the waitlist! We'll be in touch soon.",
      };
    }

    await this.waitlistModel.create({
      email: dto.email.toLowerCase().trim(),
      name: dto.name?.trim(),
      source: dto.source ?? 'landing_page',
      referrer: dto.referrer,
    });

    const position = await this.waitlistModel.countDocuments();
    this.logger.log(`New waitlist signup: ${dto.email} (#${position})`);

    return {
      position,
      message: `You're #${position} on the waitlist! We'll email you when access opens.`,
    };
  }

  async getAll(page = 1, limit = 50): Promise<{ data: WaitlistDocument[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.waitlistModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.waitlistModel.countDocuments(),
    ]);
    return { data: data as WaitlistDocument[], total, pages: Math.ceil(total / limit) };
  }

  async getStats(): Promise<{ total: number; today: number; thisWeek: number }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [total, today, thisWeek] = await Promise.all([
      this.waitlistModel.countDocuments(),
      this.waitlistModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      this.waitlistModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
    ]);

    return { total, today, thisWeek };
  }
}
