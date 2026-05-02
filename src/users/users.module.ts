import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from '../common/schemas/user.schema';
import { Workout, WorkoutSchema } from '../common/schemas/workout.schema';
import { Progress, ProgressSchema } from '../common/schemas/progress.schema';
import { BodyAnalysis, BodyAnalysisSchema } from '../common/schemas/body-analysis.schema';
import { BodyAnalysisRecord, BodyAnalysisRecordSchema } from '../common/schemas/body-analysis-record.schema';
import { MealLog, MealLogSchema } from '../common/schemas/meal-log.schema';
import { ChatMessage, ChatMessageSchema } from '../common/schemas/chat-message.schema';
import { AiTokenUsage, AiTokenUsageSchema } from '../common/schemas/ai-token-usage.schema';
import { Subscription, SubscriptionSchema } from '../common/schemas/subscription.schema';
import { Payment, PaymentSchema } from '../common/schemas/payment.schema';
import { ComprehensiveAnalysis, ComprehensiveAnalysisSchema } from '../common/schemas/comprehensive-analysis.schema';
import { UserNutritionPreferences, UserNutritionPreferencesSchema } from '../common/schemas/user-nutrition-preferences.schema';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workout.name, schema: WorkoutSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: BodyAnalysis.name, schema: BodyAnalysisSchema },
      { name: BodyAnalysisRecord.name, schema: BodyAnalysisRecordSchema },
      { name: MealLog.name, schema: MealLogSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: AiTokenUsage.name, schema: AiTokenUsageSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ComprehensiveAnalysis.name, schema: ComprehensiveAnalysisSchema },
      { name: UserNutritionPreferences.name, schema: UserNutritionPreferencesSchema },
    ]),
    MediaModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
