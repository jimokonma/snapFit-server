import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionPlan {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: SubscriptionPlan, required: true })
  plan: SubscriptionPlan;

  @Prop({ enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Prop({ required: true })
  price: number; // in kobo

  @Prop({ required: true })
  instructionsLimit: number;

  @Prop({ default: 0 })
  instructionsUsed: number;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop()
  paystackReference: string;

  @Prop()
  paystackSubscriptionId: string;

  @Prop({ default: false })
  isAutoRenew: boolean;

  @Prop()
  cancelledAt: Date;

  @Prop()
  cancellationReason: string;

  @Prop({ default: false })
  isGrandfathered: boolean; // for pricing changes

  @Prop()
  originalPrice: number; // original price when subscribed
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
