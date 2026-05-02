import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentType {
  SUBSCRIPTION = 'subscription',
  REFERRAL_REWARD = 'referral_reward',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PaymentProvider {
  PAYSTACK = 'paystack',
  PAYPRO_GLOBAL = 'paypro_global',
  NONE = 'none',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId: Types.ObjectId;

  @Prop({ enum: PaymentType, required: true })
  type: PaymentType;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ required: true })
  amount: number; // in smallest currency unit (kobo for NGN, cents for USD)

  @Prop({ required: true })
  currency: string; // 'NGN' | 'USD' | 'EUR' etc.

  @Prop({ enum: PaymentProvider, default: PaymentProvider.NONE })
  provider: PaymentProvider;

  // Paystack fields
  @Prop()
  paystackReference: string;

  @Prop()
  paystackTransactionId: string;

  // PayPro Global fields
  @Prop()
  payproReference: string;

  @Prop()
  payproOrderId: string;

  @Prop()
  description: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  paidAt: Date;

  @Prop()
  failureReason: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
