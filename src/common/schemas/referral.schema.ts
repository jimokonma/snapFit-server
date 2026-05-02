import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralDocument = Referral & Document;

export enum ReferralStatus {
  PENDING = 'pending',       // referee signed up but hasn't subscribed yet
  COMPLETED = 'completed',   // referee subscribed — reward triggered
  REWARDED = 'rewarded',     // bonus days applied to both parties
}

@Schema({ timestamps: true })
export class Referral {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  referrerId: Types.ObjectId; // the person who shared the code

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  refereeId: Types.ObjectId; // the person who used the code

  @Prop({ required: true })
  referralCode: string;

  @Prop({ enum: ReferralStatus, default: ReferralStatus.PENDING })
  status: ReferralStatus;

  @Prop()
  completedAt: Date; // when referee first subscribed

  @Prop()
  rewardedAt: Date; // when bonus days were applied

  // Both referrer and referee get 7 bonus days on the referrer's plan
  @Prop({ default: 7 })
  bonusDays: number;
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);
