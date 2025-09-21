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

  async analyzeBodyPhoto(imageUrl: string, userProfile?: any): Promise<{
    overallAssessment: string;
    bodyComposition: {
      estimatedBodyFat: string;
      muscleDevelopment: string;
      posture: string;
      symmetry: string;
    };
    strengths: string[];
    areasForImprovement: string[];
    recommendations: {
      primaryFocus: string;
      secondaryFocus: string;
      workoutIntensity: string;
      exerciseTypes: string[];
    };
    detailedDescription: string;
  }> {
    let response: any;
    try {
      const userContext = userProfile ? `
User Profile Context:
- Age: ${userProfile.age || 'Not specified'}
- Height: ${userProfile.height || 'Not specified'} cm
- Weight: ${userProfile.weight || 'Not specified'} kg
- Fitness Goal: ${userProfile.fitnessGoal || 'Not specified'}
- Experience Level: ${userProfile.experienceLevel || 'Not specified'}
- Workout History: ${userProfile.workoutHistory || 'Not specified'}
` : '';

      response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional fitness trainer and body composition expert. Analyze body photos to provide detailed physical assessments for personalized workout planning. Be specific, professional, and constructive in your analysis.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${userContext}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Analyze this body photo and provide a comprehensive physical assessment. You must respond with ONLY the following JSON format (no additional text):

{
  "overallAssessment": "Brief overall assessment of the person's current fitness level and body composition",
  "bodyComposition": {
    "estimatedBodyFat": "Estimated body fat percentage range (e.g., '15-18%')",
    "muscleDevelopment": "Assessment of muscle development across major muscle groups",
    "posture": "Posture analysis and any alignment issues",
    "symmetry": "Assessment of left-right symmetry and muscle balance"
  },
  "strengths": ["List of 3-5 physical strengths or well-developed areas"],
  "areasForImprovement": ["List of 3-5 areas that need focus or development"],
  "recommendations": {
    "primaryFocus": "Main area to focus on for workouts",
    "secondaryFocus": "Secondary area to focus on",
    "workoutIntensity": "Recommended workout intensity (beginner/intermediate/advanced)",
    "exerciseTypes": ["List of recommended exercise types/categories"]
  },
  "detailedDescription": "Detailed description of the person's physique, including specific observations about muscle development, body proportions, and physical characteristics that will inform workout planning"
}

CRITICAL: Your response must be ONLY the JSON object above. No explanations, no additional text, no markdown formatting. Just the raw JSON.`,
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
        max_tokens: 1500,
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
      
      // Log the raw response for debugging
      console.log('AI Response:', content);
      
      // Try to extract JSON from the response
      let jsonContent = content;
      
      // If the response contains markdown code blocks, extract the JSON
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      // If the response starts with text before JSON, try to find the JSON
      const jsonStart = jsonContent.indexOf('{');
      if (jsonStart > 0) {
        jsonContent = jsonContent.substring(jsonStart);
      }
      
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      console.error('Raw AI Response:', response?.choices?.[0]?.message?.content);
      
      // If JSON parsing fails, return a fallback response
      if (error.message.includes('Unexpected token')) {
        console.log('Returning fallback analysis due to JSON parsing error');
        return {
          overallAssessment: "Unable to analyze image - please try with a clearer body photo",
          bodyComposition: {
            estimatedBodyFat: "Unable to determine",
            muscleDevelopment: "Unable to assess from this image",
            posture: "Unable to assess posture",
            symmetry: "Unable to assess symmetry"
          },
          strengths: ["Please upload a clearer body photo for analysis"],
          areasForImprovement: ["Image quality needs improvement for accurate assessment"],
          recommendations: {
            primaryFocus: "General fitness improvement",
            secondaryFocus: "Overall health and wellness",
            workoutIntensity: "beginner",
            exerciseTypes: ["Cardio", "Strength training", "Flexibility"]
          },
          detailedDescription: "Unable to provide detailed analysis due to image quality or content issues. Please ensure the photo shows a clear view of the body and try again."
        };
      }
      
      throw new Error(`Failed to analyze body photo: ${error.message}`);
    }
  }

  async analyzeEquipmentPhoto(imageUrl: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
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

  async generateWorkoutFoundation(user: User, bodyAnalysis: any): Promise<{
    personalizedAdvice: string;
    recommendedWorkoutStyle: string;
    keyFocusAreas: string[];
    intensityGuidelines: string;
    progressionStrategy: string;
  }> {
    try {
      const prompt = `
Based on the following user profile and detailed body analysis, generate a comprehensive workout foundation that will be used for all future workout plans.

User Profile:
- Age: ${user.age || 'Not specified'}
- Height: ${user.height || 'Not specified'} cm
- Weight: ${user.weight || 'Not specified'} kg
- Fitness Goal: ${user.fitnessGoal || 'Not specified'}
- Experience Level: ${user.experienceLevel || 'Not specified'}
- Workout History: ${user.workoutHistory || 'Not specified'}

Body Analysis:
- Overall Assessment: ${bodyAnalysis.overallAssessment}
- Body Composition: ${JSON.stringify(bodyAnalysis.bodyComposition)}
- Strengths: ${bodyAnalysis.strengths.join(', ')}
- Areas for Improvement: ${bodyAnalysis.areasForImprovement.join(', ')}
- Recommendations: ${JSON.stringify(bodyAnalysis.recommendations)}
- Detailed Description: ${bodyAnalysis.detailedDescription}

Generate a comprehensive workout foundation in this JSON format:
{
  "personalizedAdvice": "Detailed personalized advice based on the body analysis and user goals",
  "recommendedWorkoutStyle": "Recommended workout style/approach (e.g., 'Strength-focused with cardio', 'Hypertrophy-focused', 'Functional fitness')",
  "keyFocusAreas": ["List of 3-5 key areas to focus on in workouts"],
  "intensityGuidelines": "Specific intensity guidelines based on current fitness level and goals",
  "progressionStrategy": "How to progress workouts over time based on the user's starting point and goals"
}

This foundation will be used to generate all future workout plans, so make it comprehensive and specific to this user's needs.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional personal trainer creating a personalized workout foundation based on detailed body analysis. This foundation will guide all future workout plan generation for this specific user.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to generate workout foundation: ${error.message}`);
    }
  }

  async generateWorkoutPlan(user: User, bodyAnalysis: any, equipmentList: string[]): Promise<CreateWorkoutDto> {
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

  private buildWorkoutPrompt(user: User, bodyAnalysis: any, equipmentList: string[]): string {
    const bodyAnalysisText = typeof bodyAnalysis === 'string' 
      ? bodyAnalysis 
      : `
Body Analysis:
- Overall Assessment: ${bodyAnalysis.overallAssessment}
- Body Composition: ${JSON.stringify(bodyAnalysis.bodyComposition)}
- Strengths: ${bodyAnalysis.strengths?.join(', ') || 'Not specified'}
- Areas for Improvement: ${bodyAnalysis.areasForImprovement?.join(', ') || 'Not specified'}
- Recommendations: ${JSON.stringify(bodyAnalysis.recommendations)}
- Detailed Description: ${bodyAnalysis.detailedDescription}
`;

    const workoutFoundation = user.workoutFoundation ? `
Workout Foundation (Use this as the primary guide):
- Personalized Advice: ${user.workoutFoundation.personalizedAdvice}
- Recommended Workout Style: ${user.workoutFoundation.recommendedWorkoutStyle}
- Key Focus Areas: ${user.workoutFoundation.keyFocusAreas?.join(', ') || 'Not specified'}
- Intensity Guidelines: ${user.workoutFoundation.intensityGuidelines}
- Progression Strategy: ${user.workoutFoundation.progressionStrategy}
` : '';

    return `
Create a 7-day workout plan for the following user:

User Profile:
- Age: ${user.age || 'Not specified'}
- Height: ${user.height || 'Not specified'} cm
- Weight: ${user.weight || 'Not specified'} kg
- Fitness Goal: ${user.fitnessGoal || 'Not specified'}
- Experience Level: ${user.experienceLevel || 'Not specified'}
- Workout History: ${user.workoutHistory || 'Not specified'}

${bodyAnalysisText}

${workoutFoundation}

Available Equipment:
${equipmentList.join(', ') || 'Bodyweight only'}

Requirements:
1. Create 7 different days (include 1-2 rest days)
2. Each workout day should have 4-8 exercises
3. Include sets, reps, and rest times
4. Consider the user's experience level and available equipment
5. Focus on the user's fitness goal and body analysis recommendations
6. Follow the workout foundation guidelines if provided
7. Make it progressive and safe
8. Prioritize the key focus areas identified in the body analysis

Return the response in this JSON format:
{
  "title": "Week X - [Goal] Training",
  "description": "Brief description of the plan based on body analysis and foundation",
  "weekNumber": 1,
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "isRestDay": false,
      "estimatedDuration": 45,
      "notes": "Focus on form and key areas identified in analysis",
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
