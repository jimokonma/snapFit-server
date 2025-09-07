import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdminConfigDocument = AdminConfig & Document;

@Schema({ timestamps: true })
export class AdminConfig {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Object, required: true })
  value: any;

  @Prop()
  description: string;

  @Prop({ default: false })
  isEditable: boolean;
}

export const AdminConfigSchema = SchemaFactory.createForClass(AdminConfig);
