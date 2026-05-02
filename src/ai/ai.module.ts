import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiTokenUsage, AiTokenUsageSchema } from '../common/schemas/ai-token-usage.schema';
import { ChatMessage, ChatMessageSchema } from '../common/schemas/chat-message.schema';
import { User, UserSchema } from '../common/schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AiTokenUsage.name, schema: AiTokenUsageSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
