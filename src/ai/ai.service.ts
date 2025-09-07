import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { User } from '../common/schemas/user.schema';
import { CreateWorkoutDto } from '../common/dto/workout.dto';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyzeBodyPhoto(imageUrl: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this body photo and provide insights about body type, muscle development, areas that need focus, and overall fitness level. Be specific about what you observe and provide actionable recommendations for workout planning.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`Failed to analyze body photo: ${error.message}`);
    }
  }

  async analyzeEquipmentPhoto(imageUrl: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Identify all fitness equipment in this image. Return a JSON array of equipment names. Common equipment includes: dumbbells, barbells, resistance bands, kettlebells, pull-up bar, bench, yoga mat, medicine ball, etc. If no equipment is visible, return an empty array.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 200,
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to analyze equipment photo: ${error.message}`);
    }
  }

  async generateWorkoutPlan(user: User, bodyAnalysis: string, equipmentList: string[]): Promise<CreateWorkoutDto> {
    try {
      const prompt = this.buildWorkoutPrompt(user, bodyAnalysis, equipmentList);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional personal trainer and fitness expert. Generate comprehensive, safe, and effective workout plans based on user data.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      return this.parseWorkoutResponse(content);
    } catch (error) {
      throw new Error(`Failed to generate workout plan: ${error.message}`);
    }
  }

  async generateExerciseInstructions(exerciseName: string, type: 'image' | 'video'): Promise<string> {
    try {
      const prompt = type === 'image' 
        ? `Generate a detailed image prompt for showing proper form and technique for the exercise: ${exerciseName}. Include body positioning, movement pattern, and safety considerations.`
        : `Generate a detailed video script for demonstrating the exercise: ${exerciseName}. Include step-by-step instructions, proper form cues, common mistakes to avoid, and safety tips.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fitness instructor creating instructional content for exercises.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });

      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`Failed to generate exercise instructions: ${error.message}`);
    }
  }

  async generateInstructionImage(exerciseName: string, instructionPrompt: string): Promise<string> {
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: `Professional fitness instruction image showing proper form for ${exerciseName}. ${instructionPrompt}. Clean, modern style, good lighting, clear demonstration of correct technique.`,
        size: '1024x1024',
        quality: 'standard',
        n: 1,
      });

      return response.data[0].url;
    } catch (error) {
      throw new Error(`Failed to generate instruction image: ${error.message}`);
    }
  }

  private buildWorkoutPrompt(user: User, bodyAnalysis: string, equipmentList: string[]): string {
    return `
Create a 7-day workout plan for the following user:

User Profile:
- Age: ${user.age || 'Not specified'}
- Height: ${user.height || 'Not specified'} cm
- Weight: ${user.weight || 'Not specified'} kg
- Fitness Goal: ${user.fitnessGoal || 'Not specified'}
- Experience Level: ${user.experienceLevel || 'Not specified'}
- Workout History: ${user.workoutHistory || 'Not specified'}

Body Analysis:
${bodyAnalysis}

Available Equipment:
${equipmentList.join(', ') || 'Bodyweight only'}

Requirements:
1. Create 7 different days (include 1-2 rest days)
2. Each workout day should have 4-8 exercises
3. Include sets, reps, and rest times
4. Consider the user's experience level and available equipment
5. Focus on the user's fitness goal
6. Make it progressive and safe

Return the response in this JSON format:
{
  "title": "Week X - [Goal] Training",
  "description": "Brief description of the plan",
  "weekNumber": 1,
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "isRestDay": false,
      "estimatedDuration": 45,
      "notes": "Focus on form",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 12,
          "restTime": 60,
          "notes": "Keep back straight"
        }
      ]
    }
  ]
}
`;
  }

  private parseWorkoutResponse(content: string): CreateWorkoutDto {
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse workout response: ${error.message}`);
    }
  }
}
