import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Referral, ReferralDocument, ReferralStatus } from '../common/schemas/referral.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel(Referral.name) private referralModel: Model<ReferralDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private subscriptionsService: SubscriptionsService,
  ) {}

  // ── Referral Code ─────────────────────────────────────────────────────

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.referralCode) return user.referralCode;

    const code = await this.createUniqueCode(user.firstName ?? '', userId);
    await this.userModel.findByIdAndUpdate(userId, { referralCode: code });
    return code;
  }

  async getReferralCode(userId: string): Promise<{ code: string; referralLink: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let code = user.referralCode;
    if (!code) {
      code = await this.generateReferralCode(userId);
    }

    const appUrl = process.env.APP_URL ?? 'https://Gymtedd.app';
    return { code, referralLink: `${appUrl}/ref/${code}` };
  }

  // ── Apply referral on signup ──────────────────────────────────────────

  async applyReferralCode(newUserId: string, referralCode: string): Promise<void> {
    const referrer = await this.userModel.findOne({ referralCode });
    if (!referrer) return; // silently ignore invalid codes

    const referrerId = (referrer as any)._id.toString();
    if (referrerId === newUserId) return; // can't refer yourself

    // Prevent double-referral
    const existing = await this.referralModel.findOne({
      refereeId: new Types.ObjectId(newUserId),
    });
    if (existing) return;

    await this.referralModel.create({
      referrerId: new Types.ObjectId(referrerId),
      refereeId: new Types.ObjectId(newUserId),
      referralCode,
      status: ReferralStatus.PENDING,
    });

    await this.userModel.findByIdAndUpdate(newUserId, { referredBy: referralCode });
  }

  // ── Complete referral when referee subscribes ─────────────────────────

  async completeReferral(refereeId: string): Promise<void> {
    const referral = await this.referralModel.findOne({
      refereeId: new Types.ObjectId(refereeId),
      status: ReferralStatus.PENDING,
    });

    if (!referral) return;

    await this.referralModel.findByIdAndUpdate(referral._id, {
      status: ReferralStatus.COMPLETED,
      completedAt: new Date(),
    });

    // Grant 7 bonus days to both referrer and referee
    await Promise.all([
      this.subscriptionsService.addBonusDays(referral.referrerId.toString(), referral.bonusDays),
      this.subscriptionsService.addBonusDays(refereeId, referral.bonusDays),
    ]);

    await this.referralModel.findByIdAndUpdate(referral._id, {
      status: ReferralStatus.REWARDED,
      rewardedAt: new Date(),
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  async getUserReferralStats(userId: string): Promise<{
    code: string;
    referralLink: string;
    totalReferrals: number;
    completedReferrals: number;
    bonusDaysEarned: number;
  }> {
    const { code, referralLink } = await this.getReferralCode(userId);
    const referrals = await this.referralModel.find({
      referrerId: new Types.ObjectId(userId),
    });

    const completed = referrals.filter(r => r.status !== ReferralStatus.PENDING);

    return {
      code,
      referralLink,
      totalReferrals: referrals.length,
      completedReferrals: completed.length,
      bonusDaysEarned: completed.length * 7,
    };
  }

  async getAllReferrals(): Promise<Referral[]> {
    return this.referralModel
      .find()
      .populate('referrerId', 'email firstName lastName')
      .populate('refereeId', 'email firstName lastName')
      .sort({ createdAt: -1 });
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async createUniqueCode(firstName: string, userId: string): Promise<string> {
    const base = (firstName.slice(0, 4) + userId.slice(-4)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    let candidate = base;
    let attempt = 0;

    while (await this.userModel.findOne({ referralCode: candidate })) {
      attempt++;
      candidate = `${base}${attempt}`;
    }

    return candidate;
  }
}
