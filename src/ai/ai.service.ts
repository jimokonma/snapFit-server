import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

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

@Injectable()
export class AiService {
  private anthropic: Anthropic;
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
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

  async validatePhoto(
    imageUrl: string,
    photoType: PhotoType,
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
  ): Promise<WorkoutPlanResult> {
    const daysPerWeek = userProfile.daysPerWeek || 4;
    const level = userProfile.experienceLevel || 'beginner';
    const goal = userProfile.fitnessGoal || 'general_fitness';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are an expert personal trainer creating personalized 7-day workout plans. Generate safe, effective, periodized plans tailored to the user's body analysis and goals. For each exercise include a concise 1-2 sentence "description" explaining what the exercise is and its primary benefit. Respond only with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Create a personalized 7-day workout plan for this user.

User Profile:
- Age: ${userProfile.age || 'Not specified'}
- Height: ${userProfile.height || 'Not specified'} cm
- Weight: ${userProfile.weight || 'Not specified'} kg
- Gender: ${userProfile.gender || 'Not specified'}
- Experience Level: ${level}
- Workout History: ${userProfile.workoutHistory || 'Limited'}
- Fitness Goal: ${goal}
- Days Available Per Week: ${daysPerWeek} (schedule ${daysPerWeek} training days, rest the others)
- Injuries/Limitations: ${userProfile.injuries || 'None'}

Body Analysis:
- Overall: ${bodyAnalysis.overallAssessment}
- Muscle Development: ${bodyAnalysis.bodyComposition.muscleDevelopment}
- Posture: ${bodyAnalysis.bodyComposition.posture}
- Priority Areas: ${bodyAnalysis.bodyComposition.priorityAreas.join(', ')}
- Strengths: ${bodyAnalysis.strengths.join(', ')}
- Areas for Improvement: ${bodyAnalysis.areasForImprovement.join(', ')}

Intensity guidelines by level:
- Beginner: compound movements, higher reps (10-15), longer rest (90-120s), 3-4 training days
- Intermediate: compound + isolation mix, moderate reps (8-12), rest 60-90s, 4-5 training days
- Advanced: high specificity, periodized intensity, 3-12 reps, rest 45-75s, 5-6 training days

Respond with ONLY this JSON (all 7 days must be present, Sunday is always rest):
{
  "title": "Your Personalized Fitness Plan",
  "description": "2 sentence description of this plan",
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "focus": "Upper Body Strength",
      "isRestDay": false,
      "estimatedDuration": 60,
      "exercises": [
        { "name": "Bench Press", "sets": 4, "reps": "6-8", "restTime": "90s", "description": "A compound push movement targeting chest, shoulders, and triceps through a full press from chest to full arm extension.", "notes": "Keep shoulder blades retracted" }
      ]
    }
  ],
  "nutrition": {
    "caloricBaseline": "estimated daily caloric need based on their stats and goal",
    "macroTargets": "protein/carb/fat targets aligned to goal",
    "mealTiming": "pre/post workout meal suggestions"
  },
  "progressTracking": {
    "weeklyMilestones": ["milestone to watch week 1", "milestone week 2", "milestone week 3", "milestone week 4"],
    "strengthBenchmarks": ["benchmark exercise 1 target", "benchmark exercise 2 target"],
    "photoRetakeDate": "Retake progress photos in 4 weeks"
  },
  "motivationalNote": "Personalized encouraging message based on their specific goals and current state"
}`,
        },
      ],
    });

    return this.parseJson(
      (response.content[0] as { type: 'text'; text: string }).text,
      this.getDefaultWorkoutPlan(),
    );
  }

  async generateExerciseInstructions(exerciseName: string): Promise<string> {
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

    return (response.content[0] as { type: 'text'; text: string }).text;
  }

  async generateExerciseImage(exerciseName: string, category?: string, instructions?: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Add it to generate exercise images.');
    }

    // Use Claude to write a precise, exercise-specific DALL-E prompt
    const promptMsg = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a single DALL-E image generation prompt (max 100 words) for a fitness reference illustration of: "${exerciseName}"${category ? ` (${category})` : ''}.
${instructions ? `Instructions: ${instructions}` : ''}

Requirements:
- Describe the EXACT starting body position for this specific exercise (limb angles, joint positions, spine alignment, foot placement)
- Show a fit athlete in proper form wearing athletic clothing
- Clean white or gym background, educational illustration style
- Side or 45-degree angle that best reveals the movement mechanics
- High detail on correct muscle engagement and posture
- Output ONLY the prompt text, no explanation or preamble`,
      }],
    });

    const prompt = (promptMsg.content[0] as any).text?.trim() ||
      `Clean instructional fitness illustration of "${exerciseName}"${category ? ` (${category})` : ''}. Fit athlete in proper starting position wearing athletic clothing, side-view in a modern gym. Educational, photorealistic, focused on correct form and body alignment.`;

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
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
  }): Promise<string> {
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
        content: `Write a single short video generation prompt (max 120 words) for a text-to-video AI model showing the exercise: "${exercise.name}".
${exercise.category ? `Category: ${exercise.category}` : ''}
${exercise.instructions ? `Instructions: ${exercise.instructions}` : ''}
${exercise.notes ? `Notes: ${exercise.notes}` : ''}

Requirements:
- Describe a fit male athlete in gym clothes inside a professional gym with dark moody lighting
- Explicitly show the FULL movement cycle: starting position → mid-movement → ending position, looped smoothly
- Name the exact body position at start and end (e.g. "arms fully extended" → "elbows at 90 degrees" → back to "arms extended")
- Choose the camera angle that best shows this movement (side view, front view, or 45-degree angle)
- Slow-motion, 4K, cinematic
- Output ONLY the prompt text, no explanation`,
      }],
    });

    const prompt = (promptMsg.content[0] as any).text?.trim() ||
      `Fit male athlete performing ${exercise.name} in a dark professional gym. Side-view camera. Slow motion showing complete movement from starting position through full range of motion and back to start. 4K cinematic lighting, educational fitness demonstration.`;

    const response = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({ input: { prompt, duration: 6 } }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${error}`);
    }

    const data: any = await response.json();

    if (data.status === 'succeeded' && data.output) {
      return Array.isArray(data.output) ? data.output[0] : data.output;
    }

    if (data.urls?.get) {
      let pollResponse: any;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const poll = await fetch(data.urls.get, {
          headers: { 'Authorization': `Bearer ${replicateKey}` },
        });
        pollResponse = await poll.json();
        if (pollResponse.status === 'succeeded') {
          const output = pollResponse.output;
          return Array.isArray(output) ? output[0] : output;
        }
        if (pollResponse.status === 'failed') {
          throw new Error('Video generation failed');
        }
      }
      throw new Error('Video generation timed out');
    }

    throw new Error('Unexpected response from Replicate API');
  }

  async convertExerciseToHome(exercise: { name: string; sets: number; reps: string; notes?: string }): Promise<HomeVariantResult> {
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
    options: { homeWorkout?: boolean } = {},
  ): Promise<WorkoutPlanResult> {
    const daysPerWeek = userProfile.daysPerWeek || 4;
    const level = userProfile.experienceLevel || 'beginner';
    const goal = userProfile.fitnessGoal || 'general_fitness';
    const homeNote = options.homeWorkout
      ? '\n\nIMPORTANT: ALL exercises MUST be bodyweight-only. No gym equipment allowed. Use floor, walls, chairs, and body weight only. This is a home workout plan.'
      : '';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are an expert personal trainer creating personalized 7-day workout plans. Generate safe, effective, periodized plans tailored to the user's body analysis and goals. For each exercise include a concise 1-2 sentence "description" explaining what the exercise is and its primary benefit. Respond only with valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Create a personalized 7-day workout plan for this user.${homeNote}

User Profile:
- Age: ${userProfile.age || 'Not specified'}
- Height: ${userProfile.height || 'Not specified'} cm
- Weight: ${userProfile.weight || 'Not specified'} kg
- Gender: ${userProfile.gender || 'Not specified'}
- Experience Level: ${level}
- Workout History: ${userProfile.workoutHistory || 'Limited'}
- Fitness Goal: ${goal}
- Days Available Per Week: ${daysPerWeek} (schedule ${daysPerWeek} training days, rest the others)
- Injuries/Limitations: ${userProfile.injuries || 'None'}

Body Analysis:
- Overall: ${bodyAnalysis.overallAssessment}
- Muscle Development: ${bodyAnalysis.bodyComposition.muscleDevelopment}
- Posture: ${bodyAnalysis.bodyComposition.posture}
- Priority Areas: ${bodyAnalysis.bodyComposition.priorityAreas.join(', ')}
- Strengths: ${bodyAnalysis.strengths.join(', ')}
- Areas for Improvement: ${bodyAnalysis.areasForImprovement.join(', ')}

Respond with ONLY this JSON (all 7 days present, Sunday always rest):
{
  "title": "Your Personalized Fitness Plan",
  "description": "2 sentence description",
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "focus": "Upper Body Strength",
      "isRestDay": false,
      "estimatedDuration": 60,
      "exercises": [
        { "name": "Bench Press", "sets": 4, "reps": "6-8", "restTime": "90s", "description": "A compound push movement targeting chest, shoulders, and triceps through a full press from chest to full arm extension.", "notes": "Keep shoulder blades retracted" }
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

  async compareBodyAnalyses(
    firstAnalysis: BodyAnalysisResult,
    latestAnalysis: BodyAnalysisResult,
    daysBetween: number,
    fitnessGoal: string,
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
