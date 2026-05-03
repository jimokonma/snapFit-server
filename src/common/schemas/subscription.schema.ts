import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  ELITE = 'elite',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

// -1 means unlimited
export const TIER_QUOTAS: Record<SubscriptionTier, {
  nutritionScansPerMonth: number;
  aiImagesPerMonth: number;
  aiVideosPerMonth: number;
  bodyAnalysisPerPeriod: number;
  bodyAnalysisResetsMonthly: boolean;
}> = {
  [SubscriptionTier.FREE]: {
    nutritionScansPerMonth: 3,
    aiImagesPerMonth: 3,
    aiVideosPerMonth: 0,
    bodyAnalysisPerPeriod: 1,
    bodyAnalysisResetsMonthly: false, // lifetime cap — never resets
  },
  [SubscriptionTier.PRO]: {
    nutritionScansPerMonth: 30,
    aiImagesPerMonth: 30,
    aiVideosPerMonth: 5,
    bodyAnalysisPerPeriod: 1,
    bodyAnalysisResetsMonthly: true,
  },
  [SubscriptionTier.ELITE]: {
    nutritionScansPerMonth: -1,
    aiImagesPerMonth: -1,
    aiVideosPerMonth: 15,
    bodyAnalysisPerPeriod: 4,
    bodyAnalysisResetsMonthly: true,
  },
};

// Prices in kobo (₦ × 100)
export const TIER_PRICING = {
  [SubscriptionTier.PRO]: {
    [BillingCycle.MONTHLY]: 450000,  // ₦4,500
    [BillingCycle.YEARLY]: 3500000, // ₦35,000
  },
  [SubscriptionTier.ELITE]: {
    [BillingCycle.MONTHLY]: 900000,  // ₦9,000
    [BillingCycle.YEARLY]: 6500000, // ₦65,000
  },
};

// USD prices in cents for PayPro Global international checkout
export const TIER_PRICING_USD = {
  [SubscriptionTier.PRO]: {
    [BillingCycle.MONTHLY]: 281,   // $2.81
    [BillingCycle.YEARLY]: 2188,  // $21.88
  },
  [SubscriptionTier.ELITE]: {
    [BillingCycle.MONTHLY]: 563,   // $5.63
    [BillingCycle.YEARLY]: 4063,  // $40.63
  },
};

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: SubscriptionTier, required: true })
  tier: SubscriptionTier;

  @Prop({ enum: BillingCycle })
  billingCycle: BillingCycle;

  @Prop({ enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ default: 0 })
  price: number; // in kobo (0 for free tier)

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  // ── Monthly quota counters (reset on quotaResetDate) ──────────────────
  @Prop({ default: 0 })
  nutritionScansUsed: number;

  @Prop({ default: 0 })
  aiImagesUsed: number;

  @Prop({ default: 0 })
  aiVideosUsed: number;

  // Resets monthly for Pro/Elite; never resets for Free (lifetime cap)
  @Prop({ default: 0 })
  bodyAnalysisUsed: number;

  @Prop()
  quotaResetDate: Date;

  // ── Payment references ────────────────────────────────────────────────
  @Prop()
  paystackReference: string;

  @Prop()
  payproReference: string;

  @Prop({ enum: ['paystack', 'paypro_global', 'none'], default: 'none' })
  paymentProvider: string;

  // ── Lifecycle ─────────────────────────────────────────────────────────
  @Prop({ default: false })
  isAutoRenew: boolean;

  @Prop()
  cancelledAt: Date;

  @Prop()
  cancellationReason: string;

  @Prop({ default: false })
  isGrandfathered: boolean;

  @Prop({ default: false })
  grantedByAdmin: boolean;

  @Prop()
  originalPrice: number;

  @Prop({ default: 0 })
  bonusDaysAdded: number; // extra days granted via referral rewards
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
