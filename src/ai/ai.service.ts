import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { User } from '../common/schemas/user.schema';
import { CreateWorkoutDto } from '../common/dto/workout.dto';
import { VideoGenerationService } from './video-generation.service';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private videoGenerationService: VideoGenerationService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyzeMultipleBodyPhotos(photoUrls: string[], userProfile?: any): Promise<{
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

      // Create image content array for all photos
      const imageContent = photoUrls.map((url, index) => ({
        type: 'image_url' as const,
        image_url: {
          url: url,
          detail: 'high' as const,
        },
      }));

      response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional fitness trainer and body composition specialist. You are analyzing fitness photos to provide personalized workout recommendations for legitimate fitness purposes.

IMPORTANT RULES:
1. You MUST respond with ONLY valid JSON - no explanations, no additional text
2. Analyze the person's physique, muscle development, and body composition
3. Provide specific, professional fitness assessment based on what you observe
4. Your response must be ONLY the JSON object - no markdown, no code blocks, no additional text
5. This is for creating personalized workout plans and fitness guidance`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${userContext}

TASK: As a professional fitness trainer, analyze these body photos to assess the person's current physique, muscle development, and body composition. Provide a detailed fitness assessment for creating a personalized workout plan.

REQUIREMENTS:
- You MUST respond with ONLY valid JSON (no additional text)
- Analyze ALL photos to assess physique, muscle development, and body composition
- Provide specific observations about muscle mass, body fat, posture, and symmetry
- Give detailed fitness assessment based on what you can observe
- This is for legitimate fitness training and workout planning

RESPOND WITH ONLY THIS JSON FORMAT:

{
  "overallAssessment": "Comprehensive assessment based on all body photos showing different angles",
  "bodyComposition": {
    "estimatedBodyFat": "Estimated body fat percentage range based on visible muscle definition and body shape from all angles",
    "muscleDevelopment": "Assessment of visible muscle development across major muscle groups from all views",
    "posture": "Posture analysis from all angles and any visible alignment issues",
    "symmetry": "Assessment of left-right symmetry and muscle balance from multiple views"
  },
  "strengths": ["List 3-5 physical strengths or well-developed areas you can observe from all photos"],
  "areasForImprovement": ["List 3-5 areas that need focus or development based on your comprehensive analysis"],
  "recommendations": {
    "primaryFocus": "Main area to focus on for workouts based on your comprehensive analysis",
    "secondaryFocus": "Secondary area to focus on",
    "workoutIntensity": "Recommended workout intensity (beginner/intermediate/advanced)",
    "exerciseTypes": ["List of recommended exercise types/categories"]
  },
  "detailedDescription": "Comprehensive description of what you observe about the person's physique, muscle development, body proportions, and physical characteristics from all body photos"
}

CRITICAL: Respond with ONLY the JSON object above. No explanations, no additional text, no markdown.`,
              },
              ...imageContent,
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
      
      // Log the raw response for debugging
      console.log('=== AI MULTIPLE BODY ANALYSIS DEBUG ===');
      console.log('Photo URLs:', photoUrls);
      console.log('User Context:', userContext);
      console.log('Raw AI Response:', content);
      console.log('Response Length:', content?.length);
      console.log('================================');
      
      // Check if AI refused to analyze
      if (content.toLowerCase().includes("i'm sorry") || 
          content.toLowerCase().includes("i can't") || 
          content.toLowerCase().includes("i cannot")) {
        throw new Error('AI refused to analyze images');
      }
      
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
      console.error('=== AI MULTIPLE ANALYSIS ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      console.error('Raw AI Response:', response?.choices?.[0]?.message?.content);
      console.error('Response Status:', response?.status);
      console.error('Response Headers:', response?.headers);
      console.error('========================');
      
      // Try alternative approach with a different prompt
      try {
        console.log('AI refused to analyze images, trying alternative approach...');
        
        // Recreate variables for alternative approach
        const alternativeUserContext = userProfile ? `
User Profile Context:
- Age: ${userProfile.age || 'Not specified'}
- Height: ${userProfile.height || 'Not specified'} cm
- Weight: ${userProfile.weight || 'Not specified'} kg
- Fitness Goal: ${userProfile.fitnessGoal || 'Not specified'}
- Experience Level: ${userProfile.experienceLevel || 'Not specified'}
- Workout History: ${userProfile.workoutHistory || 'Not specified'}
` : '';

        const alternativeImageContent = photoUrls.map((url, index) => ({
          type: 'image_url' as const,
          image_url: {
            url: url,
            detail: 'high' as const,
          },
        }));
        
        const alternativeResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a professional fitness trainer and body composition specialist. Analyze the fitness photos and provide detailed body assessment in JSON format only.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${alternativeUserContext}

As a professional fitness trainer, analyze these body photos to assess physique, muscle development, and body composition. Provide detailed body analysis for workout planning. Respond with only JSON:

{
  "overallAssessment": "General fitness level assessment",
  "bodyComposition": {
    "estimatedBodyFat": "General estimate",
    "muscleDevelopment": "General assessment",
    "posture": "General posture notes",
    "symmetry": "General symmetry assessment"
  },
  "strengths": ["General strengths"],
  "areasForImprovement": ["General areas for improvement"],
  "recommendations": {
    "primaryFocus": "General focus area",
    "secondaryFocus": "Secondary focus",
    "workoutIntensity": "beginner",
    "exerciseTypes": ["General exercise types"]
  },
  "detailedDescription": "General description of fitness level and recommendations"
}`,
                },
                ...alternativeImageContent,
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        });

        const alternativeContent = alternativeResponse.choices[0].message.content;
        console.log('Alternative AI Response:', alternativeContent);
        
        if (alternativeContent.toLowerCase().includes("i'm sorry") || 
            alternativeContent.toLowerCase().includes("i can't")) {
          console.log('Alternative approach also failed, returning fallback analysis');
          return this.getFallbackBodyAnalysis();
        }
        
        // Extract JSON from the response, removing any extra text
        let jsonContent = alternativeContent;
        
        // If the response contains markdown code blocks, extract the JSON
        const jsonMatch = alternativeContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }
        
        // If the response starts with text before JSON, try to find the JSON
        const jsonStart = jsonContent.indexOf('{');
        if (jsonStart > 0) {
          jsonContent = jsonContent.substring(jsonStart);
        }
        
        // Find the end of the JSON object
        const jsonEnd = jsonContent.lastIndexOf('}');
        if (jsonEnd > 0) {
          jsonContent = jsonContent.substring(0, jsonEnd + 1);
        }
        
        console.log('Extracted JSON:', jsonContent);
        return JSON.parse(jsonContent);
      } catch (alternativeError) {
        console.error('Alternative approach also failed, returning fallback analysis');
        return this.getFallbackBodyAnalysis();
      }
    }
  }

  private getFallbackBodyAnalysis() {
    return {
      overallAssessment: "Unable to analyze image - please try with a clearer body photo",
      bodyComposition: {
        estimatedBodyFat: "Unable to determine",
        muscleDevelopment: "Unable to assess from this image",
        posture: "Unable to assess posture",
        symmetry: "Unable to assess symmetry"
      },
      strengths: [
        "Please upload a clearer body photo for analysis"
      ],
      areasForImprovement: [
        "Image quality needs improvement for accurate assessment"
      ],
      recommendations: {
        primaryFocus: "General fitness improvement",
        secondaryFocus: "Overall health and wellness",
        workoutIntensity: "beginner",
        exerciseTypes: [
          "Cardio",
          "Strength training",
          "Flexibility"
        ]
      },
      detailedDescription: "Unable to provide detailed analysis due to image quality or content issues. Please ensure the photo shows a clear view of the body and try again."
    };
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
            content: `You are a professional fitness trainer creating personalized workout plans. Analyze the provided image to understand the person's current fitness level and create appropriate exercise recommendations.

IMPORTANT RULES:
1. You MUST respond with ONLY valid JSON - no explanations, no additional text
2. Focus on general fitness assessment and exercise recommendations
3. Provide professional, constructive fitness guidance
4. Your response must be ONLY the JSON object - no markdown, no code blocks, no additional text
5. This is for creating safe, effective workout plans`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${userContext}

TASK: Analyze this image to create a personalized workout plan based on the person's current fitness level.

REQUIREMENTS:
- You MUST respond with ONLY valid JSON (no additional text)
- Focus on general fitness level and exercise recommendations
- Provide professional fitness guidance for workout planning
- This is for creating safe, effective exercise programs

RESPOND WITH ONLY THIS JSON FORMAT:

{
  "overallAssessment": "Brief overall assessment of the person's current fitness level and body composition based on what you can observe",
  "bodyComposition": {
    "estimatedBodyFat": "Estimated body fat percentage range based on visible muscle definition and body shape",
    "muscleDevelopment": "Assessment of visible muscle development across major muscle groups",
    "posture": "Posture analysis and any visible alignment issues",
    "symmetry": "Assessment of left-right symmetry and muscle balance"
  },
  "strengths": ["List 3-5 physical strengths or well-developed areas you can observe"],
  "areasForImprovement": ["List 3-5 areas that need focus or development based on your analysis"],
  "recommendations": {
    "primaryFocus": "Main area to focus on for workouts based on your analysis",
    "secondaryFocus": "Secondary area to focus on",
    "workoutIntensity": "Recommended workout intensity (beginner/intermediate/advanced)",
    "exerciseTypes": ["List of recommended exercise types/categories"]
  },
  "detailedDescription": "Detailed description of what you observe about the person's physique, muscle development, body proportions, and physical characteristics"
}

CRITICAL: Respond with ONLY the JSON object above. No explanations, no additional text, no markdown.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high', // "low", "high", or "auto" - using "high" for detailed body analysis
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
      console.log('=== AI BODY ANALYSIS DEBUG ===');
      console.log('Image URL:', imageUrl);
      console.log('User Context:', userContext);
      console.log('Raw AI Response:', content);
      console.log('Response Length:', content?.length);
      console.log('================================');
      
      // Check if AI refused to analyze
      if (content.toLowerCase().includes("i'm sorry") || 
          content.toLowerCase().includes("i can't") || 
          content.toLowerCase().includes("i cannot")) {
        throw new Error('AI refused to analyze image');
      }
      
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
      console.error('=== AI ANALYSIS ERROR ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      console.error('Raw AI Response:', response?.choices?.[0]?.message?.content);
      console.error('Response Status:', response?.status);
      console.error('Response Headers:', response?.headers);
      console.error('========================');
      
      // If JSON parsing fails, try alternative approach
      if (error.message.includes('Unexpected token')) {
        console.log('AI refused to analyze image, trying alternative approach...');
        
        // Try with a more general fitness assessment approach
        try {
          const alternativeResponse = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are a fitness coach creating workout plans. Analyze the image for general fitness assessment and provide workout recommendations. Respond with valid JSON only.`,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Analyze this image for fitness planning. Provide a JSON response with: overallAssessment, bodyComposition (estimatedBodyFat, muscleDevelopment, posture, symmetry), strengths (array), areasForImprovement (array), recommendations (primaryFocus, secondaryFocus, workoutIntensity, exerciseTypes array), detailedDescription.`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageUrl,
                      detail: 'high',
                    },
                  },
                ],
              },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          });

          const altContent = alternativeResponse.choices[0].message.content;
          console.log('Alternative AI Response:', altContent);
          
          // Try to parse the alternative response
          let jsonContent = altContent;
          const jsonMatch = altContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
          const jsonStart = jsonContent.indexOf('{');
          if (jsonStart > 0) {
            jsonContent = jsonContent.substring(jsonStart);
          }

          return JSON.parse(jsonContent);
        } catch (altError) {
          console.log('Alternative approach also failed, returning fallback analysis');
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
      }
      
      throw new Error(`Failed to analyze body photo: ${error.message}`);
    }
  }

  async analyzeImageFromBuffer(imageBuffer: Buffer, mimeType: string, prompt: string = "What's in this image?"): Promise<any> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      return {
        success: true,
        data: response.choices[0].message.content,
        usage: response.usage
      };
    } catch (error) {
      console.error('Error analyzing image from buffer:', error);
      return {
        success: false,
        error: error.message
      };
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
                  detail: 'high', // High detail for equipment identification
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

  async generateExerciseMedia(exerciseName: string, type: 'image' | 'video'): Promise<string> {
    try {
      if (type === 'image') {
        // Generate a detailed prompt for the exercise
        const imagePrompt = `Professional fitness instruction image showing proper form for ${exerciseName}. 
        The image should demonstrate:
        - Correct body positioning and posture
        - Proper movement technique
        - Safety considerations
        - Clear view of the exercise being performed
        - Professional fitness environment
        - Clean, well-lit setting
        - Focus on form and technique demonstration`;
        
        const response = await this.openai.images.generate({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        });

        return response.data[0].url;
      } else {
        // Generate video using AI video generation
        return await this.generateExerciseVideo(exerciseName);
      }
    } catch (error) {
      throw new Error(`Failed to generate exercise media: ${error.message}`);
    }
  }

  private async generateExerciseVideo(exerciseName: string): Promise<string> {
    try {
      // Create a detailed video prompt for the exercise
      const videoPrompt = `Professional fitness instruction video demonstrating ${exerciseName}. 
      The video should show:
      - A professional fitness instructor performing the exercise
      - Proper form and technique throughout the movement
      - Multiple angles showing correct body positioning
      - Slow motion demonstration of key phases
      - Clear view of muscle engagement
      - Professional gym environment
      - 10-15 second duration
      - High quality, well-lit setting
      - Focus on safety and proper technique`;

      // Try OpenAI Sora first (when available)
      // Note: Sora API is not yet available in the OpenAI SDK
      // This is a placeholder for when it becomes available
      try {
        // For now, skip Sora and go directly to alternative services
        throw new Error('Sora not yet available in OpenAI SDK');
      } catch (soraError) {
        console.log('Sora not available, trying alternative video generation services...');
        
        // Try alternative video generation services
        try {
          const result = await this.videoGenerationService.generateExerciseVideo(exerciseName, videoPrompt);
          return result.videoUrl;
        } catch (alternativeError) {
          console.log('All video generation services failed, using fallback...');
          const fallbackResult = await this.videoGenerationService.generateFallbackVideo(exerciseName);
          return fallbackResult.videoUrl;
        }
      }
    } catch (error) {
      throw new Error(`Failed to generate exercise video: ${error.message}`);
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
