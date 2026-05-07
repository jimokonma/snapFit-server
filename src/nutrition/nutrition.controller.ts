import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NutritionService } from './nutrition.service';

@ApiTags('Nutrition')
@Controller('nutrition')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  // ── Vision Analysis ───────────────────────────────────────────────────

  @Post('meals/analyze')
  @ApiOperation({ summary: 'Analyse meal photo with Gymtedd Vision (preview, not saved)' })
  async analyzeMeal(
    @Request() req,
    @Body() body: { imageBase64: string; mediaType: string; clarifications?: string },
  ) {
    return this.nutritionService.analyzeMealPhotoWithQuota(
      req.user.sub,
      body.imageBase64,
      body.mediaType,
      body.clarifications,
    );
  }

  // ── Meal Logs ─────────────────────────────────────────────────────────

  @Post('meals')
  @ApiOperation({ summary: 'Save a meal log' })
  async createMealLog(@Request() req, @Body() body: any) {
    return this.nutritionService.createMealLog(req.user.sub, body);
  }

  @Get('meals')
  @ApiOperation({ summary: 'Get meal logs by date range' })
  async getMealLogs(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('mealType') mealType?: string,
  ) {
    return this.nutritionService.getMealLogs(req.user.sub, from, to, mealType);
  }

  @Get('meals/summary')
  @ApiOperation({ summary: 'Get daily calorie summary' })
  async getDailySummary(@Request() req, @Query('date') date: string) {
    return this.nutritionService.getDailySummary(req.user.sub, date);
  }

  @Get('meals/:id')
  @ApiOperation({ summary: 'Get a specific meal log' })
  async getMealLog(@Request() req, @Param('id') id: string) {
    return this.nutritionService.getMealLogById(req.user.sub, id);
  }

  @Delete('meals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a meal log' })
  async deleteMealLog(@Request() req, @Param('id') id: string) {
    return this.nutritionService.deleteMealLog(req.user.sub, id);
  }

  // ── Preferences ───────────────────────────────────────────────────────

  @Get('preferences')
  @ApiOperation({ summary: 'Get nutrition preferences' })
  async getPreferences(@Request() req) {
    return this.nutritionService.getOrCreatePrefs(req.user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update nutrition preferences' })
  async updatePreferences(@Request() req, @Body() body: any) {
    return this.nutritionService.updatePrefs(req.user.sub, body);
  }

  // ── Budget ────────────────────────────────────────────────────────────

  @Get('budget')
  @ApiOperation({ summary: 'Get active budget' })
  async getBudget(@Request() req) {
    return this.nutritionService.getActiveBudget(req.user.sub);
  }

  @Put('budget')
  @ApiOperation({ summary: 'Update budget (closes prior, creates new)' })
  async updateBudget(@Request() req, @Body() body: { mode: string; amount: number; currency: string }) {
    return this.nutritionService.updateBudget(req.user.sub, body);
  }

  // ── Suggestions ───────────────────────────────────────────────────────

  @Get('suggestions')
  @ApiOperation({ summary: 'Get meal suggestions (cached 24h)' })
  async getSuggestions(@Request() req, @Query('refresh') refresh?: string) {
    return this.nutritionService.getSuggestions(req.user.sub, refresh === 'true');
  }

  @Post('suggestions/regenerate')
  @ApiOperation({ summary: 'Force regenerate meal suggestions' })
  async regenerateSuggestions(@Request() req) {
    return this.nutritionService.generateAndCacheSuggestions(req.user.sub);
  }

  @Post('suggestions/:id/log')
  @ApiOperation({ summary: 'Log a suggestion as a meal' })
  async logFromSuggestion(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { mealType: string; loggedAt: string },
  ) {
    return this.nutritionService.logFromSuggestion(req.user.sub, id, body.mealType, body.loggedAt);
  }
}
