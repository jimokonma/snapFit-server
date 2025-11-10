import { Module } from '@nestjs/common';
import { MediaPipeService } from './mediapipe.service';

@Module({
  providers: [MediaPipeService],
  exports: [MediaPipeService],
})
export class MediaPipeModule {}

