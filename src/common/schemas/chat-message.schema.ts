import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Prop({ required: true })
  content: string;

  @Prop({ required: false })
  mediaUrl?: string;

  @Prop({ required: false, enum: ['generated-image', 'generated-video'] })
  mediaType?: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
