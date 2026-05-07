import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WaitlistDocument = Waitlist & Document;

@Schema({ timestamps: true })
export class Waitlist {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  name: string;

  @Prop({ default: 'landing_page' })
  source: string;

  @Prop()
  referrer: string;
}

export const WaitlistSchema = SchemaFactory.createForClass(Waitlist);
