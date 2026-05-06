import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AiTokenUsage, AiTokenUsageDocument, AiOperation, AiProvider } from '../common/schemas/ai-token-usage.schema';
import { ChatMessage, ChatMessageDocument } from '../common/schemas/chat-message.schema';
import { User, UserDocument } from '../common/schemas/user.schema';

export type PhotoType = 'upper_front' | 'upper_back' | 'side_profile' | 'full_body';

export interface PhotoValidationResult {
  passed: boolean;
  issues: string[];
  feedback: string;
}

export interface BodyAnalysisResult {
  overallAssessment: string;
  bodyComposition: {
    muscleDevelopment: string;
    posture: string;
    symmetry: string;
    priorityAreas: string[];
  };
  strengths: string[];
  areasForImprovement: string[];
}

export interface WorkoutPlanResult {
  title: string;
  description: string;
  days: Array<{
    dayNumber: number;
    dayName: string;
    focus: string;
    isRestDay: boolean;
    estimatedDuration: number;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      restTime: string;
      notes?: string;
    }>;
  }>;
  nutrition: {
    caloricBaseline: string;
    macroTargets: string;
    mealTiming: string;
  };
  progressTracking: {
    weeklyMilestones: string[];
    strengthBenchmarks: string[];
    photoRetakeDate: string;
  };
  motivationalNote: string;
}

export interface HomeVariantResult {
  name: string;
  homeInstructions: string;
  equipmentAlternative: string;
  sets: number;
  reps: string;
}

// Anthropic pricing per million tokens (as of 2025)
const ANTHROPIC_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7':   { input: 15.0, output: 75.0 },
  'claude-haiku-4-5':  { input: 0.8, output: 4.0 },
};

@Injectable()
export class AiService {
  private anthropic: Anthropic;
  private openai: OpenAI;

  private static readonly UNIVERSAL_STYLE = `Style: Premium 3D render of a highly detailed plastic fitness action figure — like a museum-quality anatomical sports collectible or resin figurine. NOT a human. A smooth sculptural toy/model object with deeply defined raised muscle groups visible across its surface.
Surface: Warm off-white to light beige matte paint, like an unglazed ceramic figurine with subtle warm beige-tan undertones. Completely matte — no gloss, no sheen, no reflections.
Head: Completely smooth, featureless, rounded — like a blank mannequin head. No face, no features, no hair.
Muscle Activation: The primary muscles targeted by the exercise glow in vivid neon green — a luminous anatomical highlight rendered directly on the muscle surface, like a body-mapping activation overlay. The green maps precisely to the worked muscle group (e.g. pectorals for chest press, quadriceps for squat, latissimus dorsi for lat pulldown). Secondary stabilizing muscles appear at a lower green intensity. All other body surfaces remain the standard warm beige-tan matte finish.
Movement Arrows: Bright neon green curved arrows overlay the figurine to indicate the direction and arc of motion — showing the movement path through each phase of the exercise.
Lighting: Soft key light from above-forward with gentle shadow depth on the raised surface relief. Cool cyan rim light tracing the silhouette edge. Soft fill shadows.
Background: Seamless dark charcoal-to-black gradient, subtle vignette. Figurine standing on a flat matte black base. Nothing else in frame.
Camera: Three-quarter view, eye-level or slightly elevated. Full figure in frame. Sharp focus throughout.
Render: Clean hyper-realistic 3D product render. PBR materials. Clinical, minimal, cinematic — premium fitness app reference imagery.`;

  constructor(
    private configService: ConfigService,
    @InjectModel(AiTokenUsage.name) private tokenUsageModel: Model<AiTokenUsageDocument>,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
    }
    this.anthropic = new Anthropic({ apiKey: anthropicKey });

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  private trackTokens(
    userId: string,
    operation: AiOperation,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const pricing = ANTHROPIC_COSTS[model] || { input: 3.0, output: 15.0 };
    const estimatedCostUsd =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output;

    this.tokenUsageModel
      .create({
        userId,
        operation,
        provider: AiProvider.ANTHROPIC,
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd,
      })
      .catch(() => {
        // Silently fail — token tracking must not break AI features
      });
  }

  async validatePhoto(
    imageUrl: string,
    photoType: PhotoType,
    userId?: string,
  ): Promise<PhotoValidationResult> {
    const requirements = this.getPhotoRequirements(photoType);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `You are an image validation AI for a fitness app. Your job is to check whether a user-submitted photo meets specific requirements for body composition analysis. Be strict but fair. Respond only with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: `Validate this ${photoType.replace('_', ' ')} photo against these requirements:
${requirements}

Respond with ONLY this JSON:
{
  "passed": true or false,
  "issues": ["list of specific issues found, empty array if passed"],
  "feedback": "one clear sentence of feedback to show the user — if passed say 'Great photo! Moving on.' — if failed give specific retake instruction"
}`,
            },
          ],
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.VALIDATE_PHOTO, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    return this.parseJson(
      (response.content[0] as { type: 'text'; text: string }).text,
      { passed: true, issues: [], feedback: 'Photo accepted.' },
    );
  }

  async analyzeBody(
    photoUrls: string[],
    userProfile: {
      age?: number;
      height?: number;
      weight?: number;
      gender?: string;
      experienceLevel?: string;
      workoutHistory?: string;
      fitnessGoal?: string;
      daysPerWeek?: number;
      injuries?: string;
    },
    userId?: string,
  ): Promise<BodyAnalysisResult> {
    const imageContent = photoUrls.map((url) => ({
      type: 'image' as const,
      source: { type: 'url' as const, url },
    }));

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `You are an expert fitness assessment AI. Analyze body composition photos to provide personalized fitness assessments. Be professional, encouraging, and constructive. Respond only with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Analyze these 4 body photos (front upper body, back upper body, side profile, full body) for this user:

User Profile:
- Age: ${userProfile.age || 'Not specified'}
- Height: ${userProfile.height || 'Not specified'} cm
- Weight: ${userProfile.weight || 'Not specified'} kg
- Gender: ${userProfile.gender || 'Not specified'}
- Experience Level: ${userProfile.experienceLevel || 'Beginner'}
- Fitness Goal: ${userProfile.fitnessGoal || 'General fitness'}
- Days Available Per Week: ${userProfile.daysPerWeek || 3}
- Injuries/Limitations: ${userProfile.injuries || 'None'}

Assess:
1. Muscle definition across major groups (chest, shoulders, arms, back, core, legs)
2. Body composition — muscle-to-fat ratio and symmetry
3. Posture — note any imbalances (rounded shoulders, anterior pelvic tilt, etc.)
4. Priority areas — 3-5 muscle groups or movement patterns needing focus
5. Validate experience level against observable fitness

Respond with ONLY this JSON:
{
  "overallAssessment": "2-3 sentence comprehensive overview",
  "bodyComposition": {
    "muscleDevelopment": "detailed assessment of visible muscle across all major groups",
    "posture": "posture analysis noting any imbalances",
    "symmetry": "bilateral symmetry assessment",
    "priorityAreas": ["area1", "area2", "area3", "area4", "area5"]
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"]
}`,
            },
          ],
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.ANALYZE_BODY, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    return this.parseJson(
      (response.content[0] as { type: 'text'; text: string }).text,
      {
        overallAssessment: 'Analysis completed based on your photos.',
        bodyComposition: {
          muscleDevelopment: 'Assessment based on profile data.',
          posture: 'Posture assessment pending.',
          symmetry: 'Symmetry assessment pending.',
          priorityAreas: ['Full body strength', 'Core stability'],
        },
        strengths: ['Commitment to fitness'],
        areasForImprovement: ['Consistency'],
      },
    );
  }

  private buildSplitStructure(daysPerWeek: number, level: string): { name: string; schedule: string; rules: string } {
    const isBeginner = level === 'beginner' || level === 'novice';

    if (daysPerWeek <= 2) {
      return {
        name: 'Full Body',
        schedule: `${daysPerWeek} training days — Full Body each day, with rest days between sessions`,
        rules: 'Each session: compound movements hitting chest, back, shoulders, legs, and core. Keep volume moderate per muscle group.',
      };
    }

    if (daysPerWeek === 3) {
      if (isBeginner) {
        return {
          name: 'Full Body 3x/week',
          schedule: 'Day 1 (Monday): Full Body | Day 2 (Wednesday): Full Body | Day 3 (Friday): Full Body | Rest: Tue, Thu, Sat, Sun',
          rules: 'Each day: balanced compound movements across ALL muscle groups (chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, core). Vary the specific exercises across the 3 days to avoid exact repetition.',
        };
      }
      return {
        name: 'Push / Pull / Legs',
        schedule: 'Day 1 (Monday): Push | Day 2 (Wednesday): Pull | Day 3 (Friday): Legs | Rest: Tue, Thu, Sat, Sun',
        rules: 'Push day — ONLY: Chest, Shoulders (Deltoids), Triceps. Pull day — ONLY: Back (Lats/Traps/Rhomboids), Biceps. Legs day — ONLY: Quads, Hamstrings, Glutes, Calves, Core. NEVER mix Push and Pull muscle groups on the same day.',
      };
    }

    if (daysPerWeek === 4) {
      if (isBeginner) {
        return {
          name: 'Full Body 4x/week',
          schedule: 'Day 1 (Monday): Full Body | Day 2 (Tuesday): Full Body | Rest (Wednesday) | Day 3 (Thursday): Full Body | Day 4 (Friday): Full Body | Rest: Sat, Sun',
          rules: 'Each day: compound movements hitting all major muscle groups. Vary exercises between sessions. Keep intensity moderate and prioritise form.',
        };
      }
      return {
        name: 'Upper / Lower Split',
        schedule: 'Day 1 (Monday): Upper Body | Day 2 (Tuesday): Lower Body | Rest (Wednesday) | Day 3 (Thursday): Upper Body | Day 4 (Friday): Lower Body | Rest: Sat, Sun',
        rules: 'Upper days — Chest, Back, Shoulders, Biceps, Triceps (balanced push and pull volume). Lower days — Quads, Hamstrings, Glutes, Calves, Core. Never put lower-body exercises on Upper day or upper-body exercises on Lower day. Vary exercises between Upper Day 1 and Upper Day 2 (e.g. Flat Bench on Day 1, Incline Bench on Day 3).',
      };
    }

    if (daysPerWeek === 5) {
      if (isBeginner) {
        return {
          name: 'Upper / Lower + Active Recovery',
          schedule: 'Day 1 (Monday): Upper Body | Day 2 (Tuesday): Lower Body | Rest (Wednesday) | Day 3 (Thursday): Upper Body | Day 4 (Friday): Lower Body | Day 5 (Saturday): Core & Mobility | Rest: Sunday',
          rules: 'Upper days: Chest, Back, Shoulders, Biceps, Triceps. Lower days: Quads, Hamstrings, Glutes, Calves, Core. Saturday: core, abs, stretching and mobility only.',
        };
      }
      return {
        name: 'Push / Pull / Legs / Push / Pull',
        schedule: 'Day 1 (Monday): Push | Day 2 (Tuesday): Pull | Day 3 (Wednesday): Legs | Rest (Thursday) | Day 4 (Friday): Push | Day 5 (Saturday): Pull | Rest: Sunday',
        rules: 'Push days — ONLY: Chest, Shoulders, Triceps. Pull days — ONLY: Back, Biceps. Legs day — ONLY: Quads, Hamstrings, Glutes, Calves + Core. Use different exercises between the two Push days and between the two Pull days (e.g. Flat Bench → Incline Bench; Barbell Row → Cable Row). NEVER mix push and pull muscles on the same day.',
      };
    }

    // 6+ days
    return {
      name: 'Push / Pull / Legs × 2',
      schedule: 'Day 1 (Monday): Push | Day 2 (Tuesday): Pull | Day 3 (Wednesday): Legs | Day 4 (Thursday): Push | Day 5 (Friday): Pull | Day 6 (Saturday): Legs | Rest: Sunday',
      rules: 'Push days — ONLY: Chest, Shoulders, Triceps. Pull days — ONLY: Back, Biceps. Legs days — ONLY: Quads, Hamstrings, Glutes, Calves + Core. Alternate exercise variations between Day 1 and Day 4 Push sessions, and between Day 2 and Day 5 Pull sessions. NEVER mix push and pull muscles on the same day.',
    };
  }

  async generateWorkoutPlan(
    userProfile: {
      age?: number;
      height?: number;
      weight?: number;
      gender?: string;
      experienceLevel?: string;
      workoutHistory?: string;
      fitnessGoal?: string;
      daysPerWeek?: number;
      injuries?: string;
    },
    bodyAnalysis: BodyAnalysisResult,
    userId?: string,
  ): Promise<WorkoutPlanResult> {
    const daysPerWeek = userProfile.daysPerWeek || 4;
    const level = userProfile.experienceLevel || 'beginner';
    const goal = userProfile.fitnessGoal || 'general_fitness';
    const split = this.buildSplitStructure(daysPerWeek, level);

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3500,
      system: `You are an expert personal trainer. Generate safe, periodized 7-day workout plans using proper training splits. Each training day needs at least 4 exercises. NEVER mix incompatible muscle groups on the same day. Respond only with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Create a personalized 7-day workout plan.

Profile: age=${userProfile.age}, height=${userProfile.height}cm, weight=${userProfile.weight}kg, gender=${userProfile.gender}, level=${level}, goal=${goal}, days/week=${daysPerWeek}, injuries=${userProfile.injuries || 'none'}

Body analysis: ${bodyAnalysis.overallAssessment} | Priority areas: ${bodyAnalysis.bodyComposition.priorityAreas.join(', ')} | Improve: ${bodyAnalysis.areasForImprovement.join(', ')}

TRAINING SPLIT: ${split.name}
WEEKLY SCHEDULE: ${split.schedule}
MUSCLE GROUP RULES: ${split.rules}

Intensity: beginner=10-15 reps/90-120s rest, intermediate=8-12 reps/60-90s, advanced=3-12 reps/45-75s

IMPORTANT: The "focus" field must describe the day type exactly (e.g. "Push — Chest, Shoulders & Triceps" or "Pull — Back & Biceps" or "Legs — Quads, Hamstrings & Glutes" or "Upper Body" or "Lower Body" or "Full Body"). Never write vague focuses like "Strength Training" or mix incompatible groups.

Return ONLY JSON matching this schema exactly:
{
  "title": string,
  "description": string,
  "days": [{
    "dayNumber": 1-7,
    "dayName": string,
    "focus": string,
    "isRestDay": boolean,
    "estimatedDuration": number,
    "exercises": [{ "name": string, "sets": number, "reps": string, "restTime": string, "description": string, "notes": string }]
  }],
  "nutrition": { "caloricBaseline": string, "macroTargets": string, "mealTiming": string },
  "progressTracking": { "weeklyMilestones": [string], "strengthBenchmarks": [string], "photoRetakeDate": string },
  "motivationalNote": string
}

All 7 days required. Sunday = rest. Training days must have ≥4 exercises each.`,
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.GENERATE_WORKOUT, 'claude-haiku-4-5-20251001', response.usage.input_tokens, response.usage.output_tokens);
    }

    return this.parseJson(
      (response.content[0] as { type: 'text'; text: string }).text,
      this.getDefaultWorkoutPlan(),
    );
  }

  async generateExerciseInstructions(exerciseName: string, userId?: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Generate step-by-step instructions for the exercise: ${exerciseName}. Include setup, execution cues, common mistakes to avoid, and safety tips. Keep it concise and actionable.`,
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.GENERATE_EXERCISE_INSTRUCTIONS, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    return (response.content[0] as { type: 'text'; text: string }).text;
  }

  async generateExerciseImage(exerciseName: string, category?: string, _instructions?: string, _userId?: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Add it to generate exercise images.');
    }

    const categoryLabel = category ? ` — ${category}` : '';
    const prompt = `Two-panel 3D product render demonstrating the ${exerciseName}${categoryLabel} exercise. LEFT panel labeled "START": figurine in the starting position. RIGHT panel labeled "END": figurine at peak contraction. In both panels, the primary target muscles are highlighted in vivid neon green as an anatomical activation map on the figurine surface, and bright neon green curved arrows show the direction and arc of motion. ${AiService.UNIVERSAL_STYLE} Clean premium fitness app reference image.`;

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024',
      quality: 'standard',
      n: 1,
    });

    return response.data[0].url;
  }

  async generateExerciseVideo(exercise: {
    name: string;
    category?: string;
    sets?: number;
    reps?: string;
    description?: string;
    instructions?: string;
    tips?: string;
    notes?: string;
  }, userId?: string): Promise<string> {
    const replicateKey = this.configService.get<string>('REPLICATE_API_KEY') || process.env.REPLICATE_API_KEY;
    if (!replicateKey) {
      throw new Error('REPLICATE_API_KEY is not configured. Add it to your environment variables to enable video generation.');
    }

    // Use Claude to write a precise movement-arc video prompt for this exercise
    const promptMsg = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a single short video generation prompt (max 140 words) for a text-to-video AI model showing the exercise: "${exercise.name}".
${exercise.category ? `Category: ${exercise.category}` : ''}
${exercise.instructions ? `Instructions: ${exercise.instructions}` : ''}
${exercise.notes ? `Notes: ${exercise.notes}` : ''}

Apply this universal visual style:
${AiService.UNIVERSAL_STYLE}

Movement requirements:
- Show the FULL movement cycle: starting position → peak contraction → back to start, looped smoothly
- Name the exact body position at start and end (e.g. "arms fully extended" → "elbows at 90 degrees" → back to "arms extended")
- Choose the camera angle that best shows this movement (side view, front view, or 45-degree angle)
- Slow-motion, cinematic

Output ONLY the prompt text, no explanation`,
      }],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.GENERATE_EXERCISE_VIDEO_PROMPT, 'claude-sonnet-4-6', promptMsg.usage.input_tokens, promptMsg.usage.output_tokens);
    }

    const prompt = (promptMsg.content[0] as any).text?.trim() ||
      `Genderless faceless muscular mannequin performing ${exercise.name}. Warm off-white matte material. Seamless dark charcoal backdrop, cyan rim lighting. Three-quarter view, full body in frame. Slow motion full movement cycle from start to peak contraction and back. Hyper-realistic 3D PBR render, cinematic.`;

    // Submit the prediction — no 'Prefer: wait' since this runs in a background task
    // and minimax/video-01 takes 3–8 minutes (far beyond the sync wait limit)
    const response = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateKey}`,
        'Content-Type': 'application/json',
      },
      // minimax/video-01 only accepts `prompt` — no `duration` parameter
      body: JSON.stringify({ input: { prompt } }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${error}`);
    }

    const data: any = await response.json();

    // Replicate immediately returns succeeded when result is cached
    if (data.status === 'succeeded' && data.output) {
      const output = data.output;
      return Array.isArray(output) ? output[0] : output;
    }

    if (!data.urls?.get) {
      throw new Error('Unexpected response from Replicate API — no polling URL');
    }

    // Poll until done — 90 attempts × 8 s = 12 minutes max (minimax typically 3–8 min)
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 8000));
      const poll = await fetch(data.urls.get, {
        headers: { 'Authorization': `Bearer ${replicateKey}` },
      });
      const pollResponse: any = await poll.json();

      if (pollResponse.status === 'succeeded') {
        const output = pollResponse.output;
        return Array.isArray(output) ? output[0] : output;
      }
      if (pollResponse.status === 'failed' || pollResponse.status === 'canceled') {
        const detail = pollResponse.error || pollResponse.status;
        throw new Error(`Video generation failed: ${detail}`);
      }
    }

    throw new Error('Video generation timed out after 12 minutes');
  }

  async convertExerciseToHome(exercise: { name: string; sets: number; reps: string; notes?: string }, userId?: string): Promise<HomeVariantResult> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Convert this gym exercise to a home workout version requiring zero equipment:

Exercise: ${exercise.name}
Sets: ${exercise.sets}
Reps: ${exercise.reps}
Notes: ${exercise.notes || 'None'}

Provide a practical home-friendly alternative. Respond with ONLY this JSON:
{
  "name": "modified exercise name or same if bodyweight",
  "homeInstructions": "numbered step-by-step execution for home. 4-6 steps maximum.",
  "equipmentAlternative": "what household item substitutes gym equipment, or 'No equipment needed'",
  "sets": ${exercise.sets},
  "reps": "${exercise.reps}"
}`,
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.CONVERT_TO_HOME, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    return this.parseJson<HomeVariantResult>(
      (response.content[0] as { type: 'text'; text: string }).text,
      {
        name: exercise.name,
        homeInstructions: `Perform ${exercise.name} using body weight only. Focus on controlled movement throughout.`,
        equipmentAlternative: 'No equipment needed',
        sets: exercise.sets,
        reps: exercise.reps,
      },
    );
  }

  async generateWorkoutPlanWithOptions(
    userProfile: {
      age?: number;
      height?: number;
      weight?: number;
      gender?: string;
      experienceLevel?: string;
      workoutHistory?: string;
      fitnessGoal?: string;
      daysPerWeek?: number;
      injuries?: string;
    },
    bodyAnalysis: BodyAnalysisResult,
    options: { homeWorkout?: boolean; exerciseFocus?: string } = {},
    userId?: string,
  ): Promise<WorkoutPlanResult> {
    const daysPerWeek = userProfile.daysPerWeek || 4;
    const level = userProfile.experienceLevel || 'beginner';
    const profileGoal = userProfile.fitnessGoal || 'general_fitness';
    const goal = options.exerciseFocus || profileGoal;
    const split = this.buildSplitStructure(daysPerWeek, level);

    const homeNote = options.homeWorkout
      ? '\n\nIMPORTANT: ALL exercises MUST be bodyweight-only. No gym equipment allowed. Use floor, walls, chairs, and body weight only. This is a home workout plan.'
      : '';
    const focusNote =
      options.exerciseFocus && options.exerciseFocus !== profileGoal
        ? `\n\nEXERCISE FOCUS OVERRIDE: The user has requested to specifically focus on "${options.exerciseFocus}". Design the entire plan around this focus while still respecting the training split structure. If "${options.exerciseFocus}" is not a recognizable fitness goal or workout style, ignore the override and fall back to their profile goal: ${profileGoal}.`
        : '';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: `You are an expert personal trainer creating personalized 7-day workout plans using proper training splits. Generate safe, effective, periodized plans. CRITICAL RULE: Each training day must target ONLY the muscle groups designated for that day type — never mix incompatible groups. Each training day MUST include at least 4 exercises. For each exercise include a concise 1-2 sentence "description" and a "notes" tip. Respond only with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Create a personalized 7-day workout plan for this user.${homeNote}${focusNote}

User Profile:
- Age: ${userProfile.age || 'Not specified'}
- Height: ${userProfile.height || 'Not specified'} cm
- Weight: ${userProfile.weight || 'Not specified'} kg
- Gender: ${userProfile.gender || 'Not specified'}
- Experience Level: ${level}
- Workout History: ${userProfile.workoutHistory || 'Limited'}
- Fitness Goal: ${goal}
- Days Available Per Week: ${daysPerWeek}
- Injuries/Limitations: ${userProfile.injuries || 'None'}

Body Analysis:
- Overall: ${bodyAnalysis.overallAssessment}
- Muscle Development: ${bodyAnalysis.bodyComposition.muscleDevelopment}
- Posture: ${bodyAnalysis.bodyComposition.posture}
- Priority Areas: ${bodyAnalysis.bodyComposition.priorityAreas.join(', ')}
- Strengths: ${bodyAnalysis.strengths.join(', ')}
- Areas for Improvement: ${bodyAnalysis.areasForImprovement.join(', ')}

━━━ TRAINING SPLIT ━━━
Split: ${split.name}
Schedule: ${split.schedule}
Rules: ${split.rules}

CRITICAL: The "focus" field must exactly name the day type with its muscle groups (e.g. "Push — Chest, Shoulders & Triceps", "Pull — Back & Biceps", "Legs — Quads, Hamstrings & Glutes", "Upper Body", "Lower Body", "Full Body"). Never use vague labels like "Strength Training". Never put a back exercise on a Push day, never put a chest exercise on a Pull day, never put upper-body exercises on a Legs day.

Respond with ONLY valid JSON (all 7 days, Sunday always rest):
{
  "title": "Your Personalized Fitness Plan",
  "description": "2 sentence description",
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "focus": "Push — Chest, Shoulders & Triceps",
      "isRestDay": false,
      "estimatedDuration": 60,
      "exercises": [
        { "name": "Bench Press", "sets": 4, "reps": "6-8", "restTime": "90s", "description": "Compound chest press targeting pectorals, anterior deltoids, and triceps.", "notes": "Keep shoulder blades retracted and planted on bench" },
        { "name": "Overhead Press", "sets": 3, "reps": "8-10", "restTime": "75s", "description": "Vertical pressing movement that builds shoulder strength and core stability.", "notes": "Brace core, avoid excessive lumbar arch" },
        { "name": "Incline Dumbbell Flye", "sets": 3, "reps": "10-12", "restTime": "60s", "description": "Isolation movement stretching and contracting the upper chest fibres.", "notes": "Slight bend in elbows throughout, control the descent" },
        { "name": "Tricep Rope Pushdown", "sets": 3, "reps": "12-15", "restTime": "60s", "description": "Cable isolation exercise targeting all three heads of the triceps.", "notes": "Lock elbows at sides, fully extend at bottom" }
      ]
    }
  ],
  "nutrition": { "caloricBaseline": "...", "macroTargets": "...", "mealTiming": "..." },
  "progressTracking": { "weeklyMilestones": [], "strengthBenchmarks": [], "photoRetakeDate": "..." },
  "motivationalNote": "..."
}`,
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.GENERATE_WORKOUT_WITH_OPTIONS, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    return this.parseJson(
      (response.content[0] as { type: 'text'; text: string }).text,
      this.getDefaultWorkoutPlan(),
    );
  }

  private getPhotoRequirements(photoType: PhotoType): string {
    const requirements: Record<PhotoType, string> = {
      upper_front: `- User faces camera directly
- Shoulders to waist clearly visible
- Arms relaxed at sides
- Athletic wear visible (no oversized clothing)
- Neutral, even lighting
REJECT if: shoulders are cut off, torso is twisted, or athletic wear is obscured`,
      upper_back: `- User's back faces camera
- Shoulders to waist clearly visible
- Arms relaxed at sides
- Shoulders parallel to camera frame
- Spine alignment should be detectable
REJECT if: back is angled, shoulders aren't symmetrical in frame, or posture is unclear`,
      side_profile: `- User's side faces camera (true 90° profile, either left or right)
- Shoulders to waist visible
- Athletic wear visible
- Posture neutral and natural
REJECT if: profile is angled away from 90° or posture is exaggerated`,
      full_body: `- Entire body visible from head to feet
- Athletic wear throughout
- Neutral stance, feet shoulder-width apart
- Good lighting throughout
REJECT if: feet are cut off, body is twisted, or significant parts of the body are outside the frame`,
    };
    return requirements[photoType];
  }

  private parseJson<T>(text: string, fallback: T): T {
    try {
      let content = text.trim();
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');
      return JSON.parse(content.substring(start, end + 1));
    } catch {
      return fallback;
    }
  }

  private getDefaultWorkoutPlan(): WorkoutPlanResult {
    return {
      title: 'Your Personalized Fitness Plan',
      description: 'A balanced full-body program tailored to your goals.',
      days: [
        {
          dayNumber: 1,
          dayName: 'Monday',
          focus: 'Full Body Strength',
          isRestDay: false,
          estimatedDuration: 45,
          exercises: [
            { name: 'Squats', sets: 3, reps: '10-12', restTime: '90s' },
            { name: 'Push-ups', sets: 3, reps: '10-15', restTime: '60s' },
            { name: 'Dumbbell Rows', sets: 3, reps: '10-12', restTime: '60s' },
          ],
        },
        { dayNumber: 2, dayName: 'Tuesday', focus: 'Rest', isRestDay: true, estimatedDuration: 0, exercises: [] },
        {
          dayNumber: 3,
          dayName: 'Wednesday',
          focus: 'Cardio & Core',
          isRestDay: false,
          estimatedDuration: 40,
          exercises: [
            { name: 'Plank', sets: 3, reps: '30-60s', restTime: '45s' },
            { name: 'Jumping Jacks', sets: 3, reps: '30 reps', restTime: '30s' },
          ],
        },
        { dayNumber: 4, dayName: 'Thursday', focus: 'Rest', isRestDay: true, estimatedDuration: 0, exercises: [] },
        {
          dayNumber: 5,
          dayName: 'Friday',
          focus: 'Full Body Hypertrophy',
          isRestDay: false,
          estimatedDuration: 50,
          exercises: [
            { name: 'Lunges', sets: 3, reps: '12 each leg', restTime: '60s' },
            { name: 'Dumbbell Press', sets: 3, reps: '10-12', restTime: '75s' },
          ],
        },
        { dayNumber: 6, dayName: 'Saturday', focus: 'Active Recovery', isRestDay: true, estimatedDuration: 30, exercises: [] },
        { dayNumber: 7, dayName: 'Sunday', focus: 'Rest', isRestDay: true, estimatedDuration: 0, exercises: [] },
      ],
      nutrition: {
        caloricBaseline: 'Consult a nutritionist for precise targets based on your body composition.',
        macroTargets: 'Aim for 0.8-1g protein per lb bodyweight; balance carbs and fats for energy.',
        mealTiming: 'Eat a balanced meal 1-2 hours before training; consume protein within 30 minutes after.',
      },
      progressTracking: {
        weeklyMilestones: [
          'Complete all scheduled workouts',
          'Increase reps or weight on at least one exercise',
          'Notice improved energy during sessions',
          'Visible improvement in form and consistency',
        ],
        strengthBenchmarks: ['Push-up progression', 'Squat depth improvement'],
        photoRetakeDate: 'Retake progress photos in 4 weeks',
      },
      motivationalNote: 'Every rep counts. Stay consistent, trust the process, and celebrate small wins along the way.',
    };
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContext?: string,
    userId?: string,
  ): Promise<string> {
    const userSection = userContext
      ? `\n\nYou are coaching this specific user:\n${userContext}\n\nAlways address them by their first name. Tailor every response to their profile — reference their goal, stats, and body analysis where relevant.`
      : '';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are SnapFit AI, a specialized fitness coach. You ONLY answer questions related to fitness, exercise, and working out. This includes: exercise techniques and form, workout programming, muscle groups and anatomy, recovery and rest, fitness nutrition (macros, pre/post workout meals), gym equipment and home alternatives, injury prevention, and fitness goals (muscle gain, fat loss, endurance).

If asked anything unrelated to fitness or exercise, politely decline and redirect to fitness topics. Keep responses concise, practical, and motivating. Use plain text only — no markdown formatting like ** or ##.${userSection}`,
      messages,
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.CHAT, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type from AI');
    const replyText = content.text;

    if (userId) {
      const user = await this.userModel.findById(userId).select('saveChatHistory').lean();
      if (user?.saveChatHistory !== false) {
        const lastUserMsg = messages[messages.length - 1];
        await this.chatMessageModel.insertMany([
          { userId, role: lastUserMsg.role, content: lastUserMsg.content },
          { userId, role: 'assistant', content: replyText },
        ]);
      }
    }

    return replyText;
  }

  // ── In-memory video job store ──────────────────────────────────────────────
  private readonly videoJobs = new Map<string, {
    status: 'pending' | 'done' | 'failed';
    videoUrl?: string;
    error?: string;
    createdAt: number;
  }>();

  async chatWithImage(
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    message: string,
    userContext?: string,
    userId?: string,
  ): Promise<string> {
    const userSection = userContext
      ? `\n\nYou are coaching this specific user:\n${userContext}`
      : '';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are SnapFit AI, a specialized fitness coach. Analyze the user's image and provide expert fitness feedback. This could be about their form, physique, food/nutrition, gym setup, or any fitness-related topic. Keep responses practical, encouraging, and actionable. Use plain text only — no markdown.${userSection}`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: message || 'What do you see in this image? Give me fitness-related feedback.',
            },
          ],
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.CHAT_IMAGE, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');
    const replyText = content.text;

    if (userId) {
      const user = await this.userModel.findById(userId).select('saveChatHistory').lean();
      if (user?.saveChatHistory !== false) {
        await this.chatMessageModel.insertMany([
          { userId, role: 'user', content: message ? `📷 ${message}` : '📷 [Photo]' },
          { userId, role: 'assistant', content: replyText },
        ]);
      }
    }

    return replyText;
  }

  async generateChatImage(prompt: string, userId?: string): Promise<{ imageUrl: string; caption: string }> {
    if (!this.openai) throw new Error('OPENAI_API_KEY is not configured');

    // Use Claude to craft a DALL-E prompt suited to fitness
    const promptMsg = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a concise DALL-E image generation prompt (max 150 words) for a fitness reference image based on this request: "${prompt}".

Apply this universal visual style:
${AiService.UNIVERSAL_STYLE}

Output ONLY the prompt text.`,
      }],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.GENERATE_CHAT_IMAGE, 'claude-sonnet-4-6', promptMsg.usage.input_tokens, promptMsg.usage.output_tokens);
    }

    const dallePrompt = (promptMsg.content[0] as any).text?.trim() ||
      `Fitness reference image: ${prompt}. Genderless faceless muscular mannequin, warm off-white matte ceramic material, seamless dark charcoal backdrop, cyan rim lighting, three-quarter view, hyper-realistic 3D PBR render.`;

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    });

    const imageUrl = response.data[0].url!;
    const caption = `Here's the image I generated for you!`;

    if (userId) {
      const user = await this.userModel.findById(userId).select('saveChatHistory').lean();
      if (user?.saveChatHistory !== false) {
        await this.chatMessageModel.insertMany([
          { userId, role: 'user', content: `✨ Generate image: ${prompt}` },
          { userId, role: 'assistant', content: caption, mediaUrl: imageUrl, mediaType: 'generated-image' },
        ]);
      }
    }

    return { imageUrl, caption };
  }

  async startVideoGeneration(prompt: string, userId?: string): Promise<string> {
    const jobId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.videoJobs.set(jobId, { status: 'pending', createdAt: Date.now() });

    // Fire-and-forget background generation
    this.runVideoGeneration(jobId, prompt, userId).catch(() => {
      this.videoJobs.set(jobId, { status: 'failed', error: 'Generation failed', createdAt: Date.now() });
    });

    // Clean up jobs older than 2 hours
    const TWO_HOURS = 7_200_000;
    for (const [id, job] of this.videoJobs) {
      if (Date.now() - job.createdAt > TWO_HOURS) this.videoJobs.delete(id);
    }

    return jobId;
  }

  private async runVideoGeneration(jobId: string, prompt: string, userId?: string): Promise<void> {
    try {
      const replicateKey = this.configService.get<string>('REPLICATE_API_KEY') || process.env.REPLICATE_API_KEY;
      if (!replicateKey) throw new Error('REPLICATE_API_KEY is not configured');

      const styledPromptMsg = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Rewrite this fitness video request as a text-to-video prompt (max 140 words) applying this universal style:
${AiService.UNIVERSAL_STYLE}

Show the FULL movement cycle: starting position → peak contraction → back to start, looped smoothly. Choose the best camera angle to reveal the movement.

Original request: "${prompt}"

Output ONLY the rewritten prompt text, no explanation.`,
        }],
      });
      if (userId) {
        this.trackTokens(userId, AiOperation.GENERATE_CHAT_VIDEO, 'claude-sonnet-4-6', styledPromptMsg.usage.input_tokens, styledPromptMsg.usage.output_tokens);
      }
      const styledPrompt = (styledPromptMsg.content[0] as any).text?.trim() || prompt;

      const response = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${replicateKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { prompt: styledPrompt } }),
      });

      if (!response.ok) throw new Error(`Replicate API error: ${await response.text()}`);
      const data: any = await response.json();

      if (data.status === 'succeeded' && data.output) {
        const output = data.output;
        const videoUrl = Array.isArray(output) ? output[0] : output;
        this.videoJobs.set(jobId, { status: 'done', videoUrl, createdAt: Date.now() });
        if (userId) {
          const user = await this.userModel.findById(userId).select('saveChatHistory').lean();
          if (user?.saveChatHistory !== false) {
            await this.chatMessageModel.create({
              userId, role: 'assistant',
              content: "Here's your generated video!",
              mediaUrl: videoUrl,
              mediaType: 'generated-video',
            });
          }
        }
        return;
      }

      if (!data.urls?.get) throw new Error('No polling URL from Replicate');

      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 8000));
        const poll = await fetch(data.urls.get, { headers: { 'Authorization': `Bearer ${replicateKey}` } });
        const pollData: any = await poll.json();

        if (pollData.status === 'succeeded') {
          const output = pollData.output;
          const videoUrl = Array.isArray(output) ? output[0] : output;
          this.videoJobs.set(jobId, { status: 'done', videoUrl, createdAt: Date.now() });
          if (userId) {
            const user = await this.userModel.findById(userId).select('saveChatHistory').lean();
            if (user?.saveChatHistory !== false) {
              await this.chatMessageModel.create({
                userId, role: 'assistant',
                content: "Here's your generated video!",
                mediaUrl: videoUrl,
                mediaType: 'generated-video',
              });
            }
          }
          return;
        }
        if (pollData.status === 'failed' || pollData.status === 'canceled') {
          throw new Error(`Video generation failed: ${pollData.error || pollData.status}`);
        }
      }

      throw new Error('Video generation timed out after 12 minutes');
    } catch (error) {
      this.videoJobs.set(jobId, { status: 'failed', error: (error as Error).message, createdAt: Date.now() });
    }
  }

  getVideoJobStatus(jobId: string): { status: string; videoUrl?: string; error?: string } {
    const job = this.videoJobs.get(jobId);
    if (!job) return { status: 'failed', error: 'Job not found or expired' };
    return { status: job.status, videoUrl: job.videoUrl, error: job.error };
  }

  async getChatHistory(userId: string): Promise<Array<{ role: string; content: string; mediaUrl?: string; mediaType?: string; createdAt: Date }>> {
    const docs = await this.chatMessageModel
      .find({ userId })
      .sort({ createdAt: 1 })
      .select('role content mediaUrl mediaType createdAt')
      .lean();
    return docs as any[];
  }

  async clearChatHistory(userId: string): Promise<void> {
    await this.chatMessageModel.deleteMany({ userId });
  }

  async compareBodyAnalyses(
    firstAnalysis: BodyAnalysisResult,
    latestAnalysis: BodyAnalysisResult,
    daysBetween: number,
    fitnessGoal: string,
    userId?: string,
  ): Promise<{
    score: number;
    headline: string;
    summary: string;
    improvements: string[];
    stillWorkingOn: string[];
  }> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: `You are an expert fitness coach evaluating before-and-after body composition analyses. Be encouraging but honest. Respond ONLY with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Compare these two body analyses from the same person taken ${daysBetween} days apart. Their goal is: ${fitnessGoal}.

BASELINE ANALYSIS (${daysBetween} days ago):
Overall: ${firstAnalysis.overallAssessment}
Muscle Development: ${firstAnalysis.bodyComposition?.muscleDevelopment}
Posture: ${firstAnalysis.bodyComposition?.posture}
Strengths: ${firstAnalysis.strengths?.join(', ')}
Areas for Improvement: ${firstAnalysis.areasForImprovement?.join(', ')}

CURRENT ANALYSIS:
Overall: ${latestAnalysis.overallAssessment}
Muscle Development: ${latestAnalysis.bodyComposition?.muscleDevelopment}
Posture: ${latestAnalysis.bodyComposition?.posture}
Strengths: ${latestAnalysis.strengths?.join(', ')}
Areas for Improvement: ${latestAnalysis.areasForImprovement?.join(', ')}

Rate progress and provide a comparison. Respond ONLY with this JSON:
{
  "score": <number 0.0-10.0, one decimal, how much improvement shown>,
  "headline": "<3-5 word achievement label e.g. 'Solid Gains Made', 'Strong Progress!'>",
  "summary": "<2-3 sentences: what changed, what improved, overall momentum>",
  "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "stillWorkingOn": ["<area still developing 1>", "<area still developing 2>"]
}`,
        },
      ],
    });

    if (userId) {
      this.trackTokens(userId, AiOperation.COMPARE_ANALYSES, 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens);
    }

    return this.parseJson(
      (response.content[0] as { type: 'text'; text: string }).text,
      {
        score: 5.0,
        headline: 'Progress Noted',
        summary: 'Your consistency is showing. Keep pushing toward your goals.',
        improvements: ['Continued dedication to training'],
        stillWorkingOn: ['Keep tracking progress regularly'],
      },
    );
  }
}
