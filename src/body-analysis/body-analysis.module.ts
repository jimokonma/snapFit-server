import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BodyAnalysisController } from './body-analysis.controller';
import { BodyAnalysisService } from './body-analysis.service';
import { BodyAnalysis, BodyAnalysisSchema } from '../common/schemas/body-analysis.schema';
import { ComprehensiveAnalysis, ComprehensiveAnalysisSchema } from '../common/schemas/comprehensive-analysis.schema';
import { User, UserSchema } from '../common/schemas/user.schema';
import { MediaPipeModule } from '../mediapipe/mediapipe.module';
import { MediaModule } from '../media/media.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BodyAnalysis.name, schema: BodyAnalysisSchema },
      { name: ComprehensiveAnalysis.name, schema: ComprehensiveAnalysisSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MediaPipeModule,
    MediaModule,
    AiModule,
  ],
  controllers: [BodyAnalysisController],
  providers: [BodyAnalysisService],
  exports: [BodyAnalysisService],
})
export class BodyAnalysisModule {}

