import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionTier,
  BillingCycle,
  SubscriptionStatus,
  TIER_QUOTAS,
  TIER_PRICING,
} from '../common/schemas/subscription.schema';
import { User, UserDocument } from '../common/schemas/user.schema';

export type QuotaType = 'nutritionScan' | 'aiImage' | 'aiVideo' | 'bodyAnalysis';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ── Subscription Creation ─────────────────────────────────────────────

  async createFreeSubscription(userId: string): Promise<Subscription> {
    const now = new Date();
    const farFuture = new Date('2099-12-31');
    const resetDate = new Date(now);
    resetDate.setMonth(resetDate.getMonth() + 1);

    const subscription = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.ACTIVE,
      price: 0,
      startDate: now,
      endDate: farFuture,
      quotaResetDate: resetDate,
      paymentProvider: 'none',
    });

    await this.userModel.findByIdAndUpdate(userId, { tier: SubscriptionTier.FREE });
    return subscription;
  }

  async createPaidSubscription(
    userId: string,
    tier: SubscriptionTier.PRO | SubscriptionTier.ELITE,
    billingCycle: BillingCycle,
    paymentProvider: 'paystack' | 'paypro_global',
    reference: string,
  ): Promise<Subscription> {
    await this.subscriptionModel.updateMany(
      { userId: new Types.ObjectId(userId), status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.EXPIRED },
    );

    const now = new Date();
    const endDate = new Date(now);
    if (billingCycle === BillingCycle.YEARLY) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const quotaResetDate = new Date(now);
    quotaResetDate.setMonth(quotaResetDate.getMonth() + 1);

    const price = TIER_PRICING[tier][billingCycle];

    const subscription = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      tier,
      billingCycle,
      status: SubscriptionStatus.ACTIVE,
      price,
      startDate: now,
      endDate,
      quotaResetDate,
      paymentProvider,
      ...(paymentProvider === 'paystack'
        ? { paystackReference: reference }
        : { payproReference: reference }),
    });

    await this.userModel.findByIdAndUpdate(userId, { tier });
    return subscription;
  }

  // ── Quota Management ──────────────────────────────────────────────────

  async getActiveSubscription(userId: string): Promise<SubscriptionDocument | null> {
    const sub = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    });
    if (!sub) return null;

    if (sub.quotaResetDate && new Date() > sub.quotaResetDate) {
      await this.resetMonthlyQuotas(sub._id.toString(), sub.tier);
      return this.subscriptionModel.findById(sub._id);
    }

    return sub;
  }

  // Alias kept for backward-compatibility with other services
  async getUserActiveSubscription(userId: string): Promise<Subscription | null> {
    return this.getActiveSubscription(userId);
  }

  private async resetMonthlyQuotas(subscriptionId: string, tier: SubscriptionTier): Promise<void> {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);

    const update: any = {
      nutritionScansUsed: 0,
      aiImagesUsed: 0,
      aiVideosUsed: 0,
      quotaResetDate: nextReset,
    };

    if (TIER_QUOTAS[tier].bodyAnalysisResetsMonthly) {
      update.bodyAnalysisUsed = 0;
    }

    await this.subscriptionModel.findByIdAndUpdate(subscriptionId, update);
  }

  async checkAndConsumeQuota(userId: string, type: QuotaType): Promise<void> {
    let sub = await this.getActiveSubscription(userId);

    if (!sub) {
      sub = (await this.createFreeSubscription(userId)) as SubscriptionDocument;
    }

    const quotas = TIER_QUOTAS[sub.tier];
    const { limit, used } = this.getQuotaValues(sub, type, quotas);

    if (limit !== -1 && used >= limit) {
      throw new ForbiddenException(
        `You have reached your ${this.quotaLabel(type)} limit for this period. Upgrade your plan to continue.`,
      );
    }

    await this.subscriptionModel.findByIdAndUpdate(sub._id, {
      $inc: { [this.quotaField(type)]: 1 },
    });
  }

  /** Check quota without consuming — throws if limit reached. */
  async checkQuota(userId: string, type: QuotaType): Promise<void> {
    let sub = await this.getActiveSubscription(userId);

    if (!sub) {
      sub = (await this.createFreeSubscription(userId)) as SubscriptionDocument;
    }

    const quotas = TIER_QUOTAS[sub.tier];
    const { limit, used } = this.getQuotaValues(sub, type, quotas);

    if (limit !== -1 && used >= limit) {
      throw new ForbiddenException(
        `You have reached your ${this.quotaLabel(type)} limit for this period. Upgrade your plan to continue.`,
      );
    }
  }

  /** Consume quota without checking — call only after a successful operation. */
  async consumeQuota(userId: string, type: QuotaType): Promise<void> {
    const sub = await this.getActiveSubscription(userId);
    if (!sub) return;

    await this.subscriptionModel.findByIdAndUpdate(sub._id, {
      $inc: { [this.quotaField(type)]: 1 },
    });
  }

  async getQuotaStatus(userId: string): Promise<{
    tier: SubscriptionTier;
    nutritionScans: { used: number; limit: number };
    aiImages: { used: number; limit: number };
    aiVideos: { used: number; limit: number };
    bodyAnalysis: { used: number; limit: number };
    quotaResetDate: Date | null;
    endDate: Date | null;
  }> {
    const sub = await this.getActiveSubscription(userId);
    if (!sub) {
      return {
        tier: SubscriptionTier.FREE,
        nutritionScans: { used: 0, limit: 3 },
        aiImages: { used: 0, limit: 3 },
        aiVideos: { used: 0, limit: 0 },
        bodyAnalysis: { used: 0, limit: 1 },
        quotaResetDate: null,
        endDate: null,
      };
    }

    const q = TIER_QUOTAS[sub.tier];
    return {
      tier: sub.tier,
      nutritionScans: { used: sub.nutritionScansUsed, limit: q.nutritionScansPerMonth },
      aiImages: { used: sub.aiImagesUsed, limit: q.aiImagesPerMonth },
      aiVideos: { used: sub.aiVideosUsed, limit: q.aiVideosPerMonth },
      bodyAnalysis: { used: sub.bodyAnalysisUsed, limit: q.bodyAnalysisPerPeriod },
      quotaResetDate: sub.quotaResetDate ?? null,
      endDate: sub.endDate,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async activateSubscription(subscriptionId: string): Promise<Subscription> {
    const sub = await this.subscriptionModel.findByIdAndUpdate(
      subscriptionId,
      { status: SubscriptionStatus.ACTIVE },
      { new: true },
    );
    if (!sub) throw new NotFoundException('Subscription not found');
    await this.userModel.findByIdAndUpdate(sub.userId, { tier: sub.tier });
    return sub;
  }

  async cancelSubscription(subscriptionId: string, reason?: string): Promise<Subscription> {
    const sub = await this.subscriptionModel.findByIdAndUpdate(
      subscriptionId,
      {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        isAutoRenew: false,
      },
      { new: true },
    );
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.userModel.findByIdAndUpdate(sub.userId, { tier: SubscriptionTier.FREE });
    await this.createFreeSubscription(sub.userId.toString());

    return sub;
  }

  async addBonusDays(userId: string, days: number): Promise<void> {
    const sub = await this.getActiveSubscription(userId);
    if (!sub) return;

    const newEndDate = new Date(sub.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);

    await this.subscriptionModel.findByIdAndUpdate(sub._id, {
      endDate: newEndDate,
      $inc: { bonusDaysAdded: days },
    });
  }

  // ── Admin ─────────────────────────────────────────────────────────────

  async getAllSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionModel
      .find()
      .populate('userId', 'email firstName lastName tier')
      .sort({ createdAt: -1 });
  }

  async getSubscriptionById(subscriptionId: string): Promise<SubscriptionDocument> {
    const sub = await this.subscriptionModel.findById(subscriptionId);
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  // ── Migration Helper ──────────────────────────────────────────────────

  async migrateAllUsersToElite(): Promise<{ migrated: number }> {
    const users = await this.userModel.find({});
    let migrated = 0;

    for (const user of users) {
      const uid = (user as any)._id;

      const existing = await this.subscriptionModel.findOne({
        userId: uid,
        status: SubscriptionStatus.ACTIVE,
        tier: SubscriptionTier.ELITE,
      });

      if (!existing) {
        await this.subscriptionModel.updateMany(
          { userId: uid, status: SubscriptionStatus.ACTIVE },
          { status: SubscriptionStatus.EXPIRED },
        );

        const now = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const resetDate = new Date(now);
        resetDate.setMonth(resetDate.getMonth() + 1);

        await this.subscriptionModel.create({
          userId: uid,
          tier: SubscriptionTier.ELITE,
          billingCycle: BillingCycle.YEARLY,
          status: SubscriptionStatus.ACTIVE,
          price: 0,
          startDate: now,
          endDate,
          quotaResetDate: resetDate,
          paymentProvider: 'none',
          isGrandfathered: true,
        });

        await this.userModel.findByIdAndUpdate(uid, { tier: SubscriptionTier.ELITE });
        migrated++;
      }
    }

    return { migrated };
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private getQuotaValues(
    sub: SubscriptionDocument,
    type: QuotaType,
    quotas: (typeof TIER_QUOTAS)[SubscriptionTier],
  ): { limit: number; used: number } {
    switch (type) {
      case 'nutritionScan':
        return { limit: quotas.nutritionScansPerMonth, used: sub.nutritionScansUsed };
      case 'aiImage':
        return { limit: quotas.aiImagesPerMonth, used: sub.aiImagesUsed };
      case 'aiVideo':
        return { limit: quotas.aiVideosPerMonth, used: sub.aiVideosUsed };
      case 'bodyAnalysis':
        return { limit: quotas.bodyAnalysisPerPeriod, used: sub.bodyAnalysisUsed };
    }
  }

  private quotaField(type: QuotaType): string {
    const map: Record<QuotaType, string> = {
      nutritionScan: 'nutritionScansUsed',
      aiImage: 'aiImagesUsed',
      aiVideo: 'aiVideosUsed',
      bodyAnalysis: 'bodyAnalysisUsed',
    };
    return map[type];
  }

  private quotaLabel(type: QuotaType): string {
    const map: Record<QuotaType, string> = {
      nutritionScan: 'nutrition scan',
      aiImage: 'AI image generation',
      aiVideo: 'AI video generation',
      bodyAnalysis: 'body analysis',
    };
    return map[type];
  }
}
