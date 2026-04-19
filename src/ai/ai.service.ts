import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

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

@Injectable()
export class AiService {
  private anthropic: Anthropic;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set. Add it to Render\'s environment variables.');
    }
    this.anthropic = new Anthropic({ apiKey });
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
      system: `You are an expert personal trainer creating personalized 7-day workout plans. Generate safe, effective, periodized plans tailored to the user's body analysis and goals. Respond only with valid JSON.`,
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
        { "name": "Bench Press", "sets": 4, "reps": "6-8", "restTime": "90s", "notes": "Keep shoulder blades retracted" }
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
}
