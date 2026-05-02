import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  MealLog,
  MealLogDocument,
  MealLogItem,
} from '../common/schemas/meal-log.schema';
import {
  MealSuggestion,
  MealSuggestionDocument,
} from '../common/schemas/meal-suggestion.schema';
import {
  UserNutritionPreferences,
  UserNutritionPreferencesDocument,
  UserBudget,
  UserBudgetDocument,
} from '../common/schemas/user-nutrition-preferences.schema';
import { User, UserDocument } from '../common/schemas/user.schema';

const VISION_SYSTEM = `You are a precise nutrition analyst. Given a food photo, identify every distinct food item, estimate quantities in standard units, and return calorie and macro estimates.
Rules:
- Return JSON only, no prose, no markdown fences.
- Use USDA reference values. Round calories to integers, macros to 1 decimal.
- Confidence 0–1. Items below 0.4 go into warnings only.
- If you are uncertain about any item, ingredient, or preparation method that would meaningfully change the nutritional estimate, add clarifyingQuestions. Each question needs: id (short snake_case), type ("boolean" for yes/no or "text" for open answer), question (concise, user-facing). Only ask when it matters for accuracy.`;

const VISION_USER = `Analyze this meal photo. Return JSON in this exact shape:
{"items":[{"name":string,"quantity":number,"unit":"piece"|"g"|"ml"|"cup"|"tbsp","calories":number,"proteinG":number,"carbsG":number,"fatG":number,"confidence":number}],"totalCalories":number,"totalProteinG":number,"totalCarbsG":number,"totalFatG":number,"warnings":string[],"clarifyingQuestions":[{"id":string,"type":"boolean"|"text","question":string}]}`;

const SUGGESTION_SYSTEM = `You are a culturally-aware nutritionist generating meal suggestions. Tailor to the user's country, workout goal, budget, and dietary restrictions. NEVER violate dietary restrictions or allergies. Return JSON only, no prose.`;

function goalToNutritionGoal(fitnessGoal?: string): string {
  switch (fitnessGoal) {
    case 'muscle_gain':
    case 'bigger_glutes':
    case 'toned_arms':
      return 'bulking';
    case 'fat_loss':
    case 'get_shredded':
    case 'flat_tummy':
      return 'cutting';
    case 'body_recomposition':
      return 'recomp';
    case 'toning':
    case 'endurance':
    case 'general_fitness':
    case 'maintenance':
    default:
      return 'maintenance';
  }
}

@Injectable()
export class NutritionService {
  private readonly anthropic: Anthropic;

  constructor(
    @InjectModel(MealLog.name) private mealLogModel: Model<MealLogDocument>,
    @InjectModel(MealSuggestion.name) private suggestionModel: Model<MealSuggestionDocument>,
    @InjectModel(UserNutritionPreferences.name) private prefsModel: Model<UserNutritionPreferencesDocument>,
    @InjectModel(UserBudget.name) private budgetModel: Model<UserBudgetDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.configService.get<string>('ANTHROPIC_API_KEY') });
  }

  // ── Vision Analysis ───────────────────────────────────────────────────

  async analyzeMealPhoto(imageBase64: string, mediaType: string, clarifications?: string) {
    const userContent: any[] = [
      { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: imageBase64 } },
      { type: 'text', text: VISION_USER },
    ];

    if (clarifications) {
      userContent.push({
        type: 'text',
        text: `The user provided these clarifications about the meal:\n${clarifications}\nUse these to improve accuracy. If all uncertainties are resolved, return an empty clarifyingQuestions array.`,
      });
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: VISION_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = response.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Failed to parse vision response');
    }
  }

  // ── Meal Logs ─────────────────────────────────────────────────────────

  async createMealLog(userId: string, dto: {
    imageUrl?: string;
    items: Omit<MealLogItem, '_id'>[];
    mealType: string;
    loggedAt: string;
    source: string;
    notes?: string;
  }) {
    const totals = dto.items.reduce(
      (acc, item) => ({
        cals: acc.cals + item.calories,
        p: acc.p + item.proteinG,
        c: acc.c + item.carbsG,
        f: acc.f + item.fatG,
      }),
      { cals: 0, p: 0, c: 0, f: 0 },
    );

    const log = await this.mealLogModel.create({
      userId: new Types.ObjectId(userId),
      imageUrl: dto.imageUrl ?? null,
      items: dto.items,
      totalCalories: totals.cals,
      totalProteinG: totals.p,
      totalCarbsG: totals.c,
      totalFatG: totals.f,
      mealType: dto.mealType,
      loggedAt: new Date(dto.loggedAt),
      source: dto.source,
      notes: dto.notes ?? null,
    });
    return log;
  }

  async getMealLogs(userId: string, from: string, to: string, mealType?: string) {
    const query: any = {
      userId: new Types.ObjectId(userId),
      loggedAt: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z'),
      },
    };
    if (mealType) query.mealType = mealType;
    return this.mealLogModel.find(query).sort({ loggedAt: -1 }).lean();
  }

  async getMealLogById(userId: string, logId: string) {
    const log = await this.mealLogModel.findOne({ _id: logId, userId: new Types.ObjectId(userId) }).lean();
    if (!log) throw new NotFoundException('Meal log not found');
    return log;
  }

  async deleteMealLog(userId: string, logId: string) {
    const result = await this.mealLogModel.deleteOne({ _id: logId, userId: new Types.ObjectId(userId) });
    if (result.deletedCount === 0) throw new NotFoundException('Meal log not found');
  }

  async getDailySummary(userId: string, date: string) {
    const logs = await this.getMealLogs(userId, date, date);
    const prefs = await this.getOrCreatePrefs(userId);

    const totalCalories = logs.reduce((s, l) => s + l.totalCalories, 0);
    const totalProtein = logs.reduce((s, l) => s + l.totalProteinG, 0);
    const totalCarbs = logs.reduce((s, l) => s + l.totalCarbsG, 0);
    const totalFat = logs.reduce((s, l) => s + l.totalFatG, 0);
    const target = prefs.dailyCalorieTarget ?? 2000;

    return { totalCalories, totalProtein, totalCarbs, totalFat, target, remaining: target - totalCalories };
  }

  // ── Preferences ───────────────────────────────────────────────────────

  async getOrCreatePrefs(userId: string) {
    const uid = new Types.ObjectId(userId);
    let prefs = await this.prefsModel.findOne({ userId: uid }).lean();
    if (!prefs) {
      const created = await this.prefsModel.create({ userId: uid });
      prefs = created.toObject();
    }
    return prefs;
  }

  async updatePrefs(userId: string, dto: Partial<{
    countryCode: string;
    cuisinePreference: string;
    dietaryRestrictions: string[];
    allergies: string[];
    dailyCalorieTarget: number;
  }>) {
    const uid = new Types.ObjectId(userId);
    return this.prefsModel.findOneAndUpdate(
      { userId: uid },
      { $set: dto },
      { upsert: true, new: true, lean: true },
    );
  }

  // ── Budget ────────────────────────────────────────────────────────────

  async getActiveBudget(userId: string) {
    const uid = new Types.ObjectId(userId);
    return this.budgetModel.findOne({ userId: uid, effectiveTo: null }).lean();
  }

  async updateBudget(userId: string, dto: { mode: string; amount: number; currency: string }) {
    const uid = new Types.ObjectId(userId);
    // Close current active budget
    await this.budgetModel.updateMany(
      { userId: uid, effectiveTo: null },
      { $set: { effectiveTo: new Date() } },
    );
    return this.budgetModel.create({
      userId: uid,
      mode: dto.mode,
      amount: dto.amount,
      currency: dto.currency,
      effectiveFrom: new Date(),
      effectiveTo: null,
    });
  }

  // ── Suggestions ───────────────────────────────────────────────────────

  async getSuggestions(userId: string, refresh = false) {
    const uid = new Types.ObjectId(userId);

    if (!refresh) {
      const cached = await this.suggestionModel
        .find({ userId: uid, expiresAt: { $gt: new Date() } })
        .lean();
      if (cached.length > 0) return cached;
    }

    return this.generateAndCacheSuggestions(userId);
  }

  async generateAndCacheSuggestions(userId: string) {
    const uid = new Types.ObjectId(userId);
    const [prefs, budget, user] = await Promise.all([
      this.getOrCreatePrefs(userId),
      this.getActiveBudget(userId),
      this.userModel.findById(userId).select('fitnessGoal').lean(),
    ]);

    const prompt = `Generate 8 meal suggestions for:
- Country: ${prefs.countryCode}
- Cuisine preference: ${prefs.cuisinePreference}
- Workout goal: ${goalToNutritionGoal((user as any)?.fitnessGoal)}
- Daily calorie target: ${prefs.dailyCalorieTarget ?? 2000} kcal
- Budget: ${budget ? `${budget.amount} ${budget.currency} (${budget.mode})` : 'unset — use reasonable local prices'}
- Dietary restrictions: ${prefs.dietaryRestrictions.join(', ') || 'none'}
- Allergies: ${prefs.allergies.join(', ') || 'none'}

Return a JSON array. Each item: {"name":string,"cuisineOrigin":string,"isLocal":boolean,"imageUrl":"","recipeSteps":string[],"ingredients":[{"name":string,"quantity":number,"unit":string,"estCost":number}],"estimatedCost":number,"currency":string,"totalCalories":number,"proteinG":number,"carbsG":number,"fatG":number,"alignedWorkoutGoal":"bulking"|"cutting"|"maintenance"|"recomp"}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SUGGESTION_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
    let items: any[];
    try {
      items = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      items = match ? JSON.parse(match[0]) : [];
    }

    // Delete old suggestions for this user and insert fresh ones
    await this.suggestionModel.deleteMany({ userId: uid });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const docs = items.map((item) => ({ ...item, userId: uid, expiresAt }));
    return this.suggestionModel.insertMany(docs);
  }

  async logFromSuggestion(userId: string, suggestionId: string, mealType: string, loggedAt: string) {
    const uid = new Types.ObjectId(userId);
    const suggestion = await this.suggestionModel.findOne({ _id: suggestionId, userId: uid }).lean();
    if (!suggestion) throw new NotFoundException('Suggestion not found');

    const items = suggestion.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      calories: Math.round(suggestion.totalCalories / suggestion.ingredients.length),
      proteinG: parseFloat((suggestion.proteinG / suggestion.ingredients.length).toFixed(1)),
      carbsG: parseFloat((suggestion.carbsG / suggestion.ingredients.length).toFixed(1)),
      fatG: parseFloat((suggestion.fatG / suggestion.ingredients.length).toFixed(1)),
      confidence: 1,
    }));

    return this.createMealLog(userId, {
      imageUrl: suggestion.imageUrl || undefined,
      items,
      mealType,
      loggedAt,
      source: 'suggestion',
    });
  }
}
