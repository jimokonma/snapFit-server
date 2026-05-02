import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { MealLog, MealLogSchema } from '../common/schemas/meal-log.schema';
import { MealSuggestion, MealSuggestionSchema } from '../common/schemas/meal-suggestion.schema';
import {
  UserNutritionPreferences,
  UserNutritionPreferencesSchema,
  UserBudget,
  UserBudgetSchema,
} from '../common/schemas/user-nutrition-preferences.schema';
import { User, UserSchema } from '../common/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MealLog.name, schema: MealLogSchema },
      { name: MealSuggestion.name, schema: MealSuggestionSchema },
      { name: UserNutritionPreferences.name, schema: UserNutritionPreferencesSchema },
      { name: UserBudget.name, schema: UserBudgetSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NutritionController],
  providers: [NutritionService],
  exports: [NutritionService],
})
export class NutritionModule {}
