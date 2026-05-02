import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AffiliateSettingsDocument = AffiliateSettings & Document;

@Schema({ collection: 'affiliate_settings' })
export class AffiliateSettings {
  @Prop({ default: true })
  enabled: boolean;
}

export const AffiliateSettingsSchema = SchemaFactory.createForClass(AffiliateSettings);
