import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { VideoGenerationService } from './video-generation.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [AiService, VideoGenerationService],
  exports: [AiService, VideoGenerationService],
})
export class AiModule {}
