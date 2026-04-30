import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BodyAnalysisController } from './body-analysis.controller';
import { BodyAnalysisService } from './body-analysis.service';
import { BodyAnalysis, BodyAnalysisSchema } from '../common/schemas/body-analysis.schema';
import { BodyAnalysisRecord, BodyAnalysisRecordSchema } from '../common/schemas/body-analysis-record.schema';
import { User, UserSchema } from '../common/schemas/user.schema';
import { Workout, WorkoutSchema } from '../common/schemas/workout.schema';
import { MediaModule } from '../media/media.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BodyAnalysis.name, schema: BodyAnalysisSchema },
      { name: BodyAnalysisRecord.name, schema: BodyAnalysisRecordSchema },
      { name: User.name, schema: UserSchema },
      { name: Workout.name, schema: WorkoutSchema },
    ]),
    MediaModule,
    AiModule,
  ],
  controllers: [BodyAnalysisController],
  providers: [BodyAnalysisService],
  exports: [BodyAnalysisService],
})
export class BodyAnalysisModule {}
