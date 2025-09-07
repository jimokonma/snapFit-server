import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentType {
  SUBSCRIPTION = 'subscription',
  ADDITIONAL_INSTRUCTIONS = 'additional_instructions',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
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
  amount: number; // in kobo

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  paystackReference: string;

  @Prop()
  paystackTransactionId: string;

  @Prop()
  description: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  paidAt: Date;

  @Prop()
  failureReason: string;

  @Prop({ default: 0 })
  instructionsPurchased: number; // for additional instructions
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
