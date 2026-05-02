import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AffiliateDocument = Affiliate & Document;

export enum AffiliateCategory {
  SUPPLEMENTS = 'supplements',
  EQUIPMENT = 'equipment',
  APPAREL = 'apparel',
  NUTRITION = 'nutrition',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class Affiliate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string; // affiliate tracking URL

  @Prop({ required: true, enum: AffiliateCategory })
  category: AffiliateCategory;

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop({ default: true })
  isActive: boolean; // admin toggles this on/off

  @Prop({ default: 0 })
  clickCount: number;

  @Prop()
  displayOrder: number; // controls ordering in the app
}

export const AffiliateSchema = SchemaFactory.createForClass(Affiliate);
