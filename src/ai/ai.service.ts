// ============================================================================
// COMPREHENSIVE MEDIAPIPE BODY ANALYSIS SPECIFICATION
// ============================================================================
// 
// OVERVIEW:
// Build a multi-angle body analysis system using Google MediaPipe Pose Detection
// to provide precise fitness assessments and personalized workout recommendations.
//
// TECHNICAL REQUIREMENTS:
// 1. MediaPipe Pose Landmarker for 33 body keypoint detection
// 2. 6-angle photo capture system (upper & lower body)
// 3. Real-time pose validation and feedback
// 4. Comprehensive biomechanical analysis
// 5. Integration with OpenAI GPT-4o for workout generation
//
// ============================================================================

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { User } from '../common/schemas/user.schema';
import { CreateWorkoutDto } from '../common/dto/workout.dto';
import { VideoGenerationService } from './video-generation.service';

// ============================================================================
// PHOTO CAPTURE SPECIFICATION
// ============================================================================
/*
REQUIRED 6 PHOTOS FOR COMPLETE BODY ANALYSIS:

UPPER BODY (3 photos):
1. Front View (Head to Waist)
   - User faces camera directly
   - Arms at sides or slightly away from body
   - Head upright, looking straight ahead
   - Capture: shoulders, chest, arms, upper back, neck alignment
   - Distance: 3-4 feet from camera
   - Lighting: Front-facing, even lighting
   - Clothing: Fitted shirt or sports bra/tank top

2. Back View (Head to Waist)
   - User faces away from camera
   - Arms at sides or slightly away from body
   - Head upright, looking forward (not at camera)
   - Capture: upper back, shoulder blades, rear deltoids, spine alignment
   - Distance: 3-4 feet from camera
   - Lighting: Even lighting on back
   - Clothing: Same as front view

3. Side View (Head to Waist)
   - User stands perpendicular to camera (90° angle)
   - Arms at sides
   - Natural standing posture
   - Capture: posture, forward head position, shoulder alignment, spinal curvature
   - Distance: 3-4 feet from camera
   - Lighting: Side lighting to show depth
   - Clothing: Same as front view

LOWER BODY (3 photos):
4. Front View (Waist to Feet)
   - User faces camera directly
   - Feet hip-width apart
   - Knees straight but not locked
   - Capture: hips, thighs, knees, calves, ankles, foot position
   - Distance: 4-5 feet from camera
   - Lighting: Front-facing, even lighting
   - Clothing: Fitted shorts or leggings

5. Back View (Waist to Feet)
   - User faces away from camera
   - Feet hip-width apart
   - Weight evenly distributed
   - Capture: glutes, hamstrings, calves, posterior chain development
   - Distance: 4-5 feet from camera
   - Lighting: Even lighting on back
   - Clothing: Same as front view

6. Side View (Waist to Feet)
   - User stands perpendicular to camera (90° angle)
   - Feet hip-width apart
   - Natural standing posture
   - Capture: hip alignment, knee alignment, ankle position, leg curvature
   - Distance: 4-5 feet from camera
   - Lighting: Side lighting to show depth
   - Clothing: Same as front view

PHOTO QUALITY REQUIREMENTS:
- Resolution: Minimum 1920x1080 (1080p)
- Format: JPEG or PNG
- File size: 2-10MB per photo
- Background: Plain, contrasting with clothing (preferably white or light colored)
- Framing: Full body part visible with 10-15% margin on all sides
- Focus: Sharp, no motion blur
- No filters or editing applied
*/

// ============================================================================
// MEDIAPIPE ANALYSIS SPECIFICATION
// ============================================================================
/*
IMPLEMENTATION REQUIREMENTS:

1. MEDIAPIPE SETUP:
   - Use @mediapipe/tasks-vision npm package
   - Load PoseLandmarker model from MediaPipe CDN
   - Configure for static image mode (not video stream)
   - Enable landmark visibility and presence scores

2. KEYPOINT DETECTION (33 landmarks per pose):
   Landmark indices and what they represent:
   
   FACE & HEAD (11 points):
   0: Nose, 1-2: Eyes (inner), 3-4: Eyes (outer), 5-6: Ears
   7-10: Mouth corners and center
   
   UPPER BODY (12 points):
   11-12: Shoulders, 13-14: Elbows, 15-16: Wrists
   17-18: Pinky fingers, 19-20: Index fingers, 21-22: Thumbs
   
   TORSO (2 points):
   23-24: Hips
   
   LOWER BODY (8 points):
   25-26: Knees, 27-28: Ankles
   29-30: Heels, 31-32: Foot indices

3. CALCULATE MEASUREMENTS FROM KEYPOINTS:

   A. POSTURE ANALYSIS:
   - Forward head angle: Calculate angle between ear (6), shoulder (12), and hip (24)
     * Normal: 0-10° forward
     * Mild forward head: 10-20°
     * Moderate: 20-30°
     * Severe: >30°
   
   - Shoulder alignment: Compare y-coordinates of landmarks 11 and 12
     * Difference <3% of total height = balanced
     * 3-5% = slight asymmetry
     * >5% = significant asymmetry
   
   - Spinal alignment (from side view):
     * Calculate curve from shoulder (12) → hip (24) → knee (26)
     * Normal lumbar curve: 40-60°
     * Excessive curve: >60° (hyperlordosis)
     * Flat spine: <40°
   
   - Hip alignment: Compare y-coordinates of landmarks 23 and 24
     * Difference <2% = balanced
     * >2% = pelvic tilt

   B. BODY PROPORTIONS:
   - Shoulder width: Distance between landmarks 11 and 12
   - Hip width: Distance between landmarks 23 and 24
   - Shoulder-to-hip ratio: shoulder_width / hip_width
     * Male ideal: 1.4-1.6
     * Female ideal: 1.0-1.2
   
   - Leg length: Distance from hip (24) to ankle (28)
   - Torso length: Distance from shoulder (12) to hip (24)
   - Leg-to-torso ratio: leg_length / torso_length
     * Normal range: 1.0-1.2

   C. SYMMETRY ANALYSIS:
   - Left vs Right comparison for:
     * Shoulder heights (landmarks 11 vs 12)
     * Hip heights (landmarks 23 vs 24)
     * Knee heights (landmarks 25 vs 26)
     * Arm lengths (shoulder to wrist: 11-15 vs 12-16)
     * Leg lengths (hip to ankle: 23-27 vs 24-28)
   
   - Symmetry score: 
     * <2% difference = Excellent
     * 2-5% = Good
     * 5-8% = Fair (note for training)
     * >8% = Poor (recommend corrective exercises)

   D. JOINT ANGLES:
   - Elbow angles (for arm positioning assessment)
   - Knee angles (for leg alignment)
   - Hip angles (for pelvic tilt)
   - Calculate using 3-point angle formula:
     angle = arccos((a²+b²-c²)/(2ab))
     where a, b, c are distances between three landmarks

   E. BODY COMPOSITION INDICATORS:
   - Muscle definition score (derived from landmark visibility confidence)
   - Body frame size (based on shoulder and hip measurements)
   - Estimated body type classification:
     * Ectomorph: Shoulder-hip ratio <1.2, narrow frame
     * Mesomorph: Shoulder-hip ratio 1.2-1.5, medium frame
     * Endomorph: Shoulder-hip ratio <1.2, wider hip measurements

4. REAL-TIME VALIDATION:
   - Check all required landmarks are detected (confidence >0.5)
   - Validate body is properly positioned (within frame boundaries)
   - Check for occlusions or missing body parts
   - Verify proper angle/view (front/back/side detection)
   - Provide instant feedback if photo needs retaking

5. DATA STRUCTURE FOR ANALYSIS:
   Store complete landmark data for each photo:
   {
     photoType: 'upper_front' | 'upper_back' | 'upper_side' | 'lower_front' | 'lower_back' | 'lower_side',
     landmarks: Array<{x, y, z, visibility, presence}>, // 33 points
     worldLandmarks: Array<{x, y, z, visibility}>, // 3D coordinates
     timestamp: Date,
     imageUrl: string,
     validationPassed: boolean,
     validationIssues: string[]
   }
*/

// ============================================================================
// ENHANCED AI SERVICE WITH MEDIAPIPE INTEGRATION
// ============================================================================

export interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface BodyAnalysisData {
  photoType: 'upper_front' | 'upper_back' | 'upper_side' | 'lower_front' | 'lower_back' | 'lower_side';
  landmarks: MediaPipeLandmark[];
  worldLandmarks: MediaPipeLandmark[];
  measurements: {
    shoulderWidth?: number;
    hipWidth?: number;
    shoulderToHipRatio?: number;
    legLength?: number;
    torsoLength?: number;
    legToTorsoRatio?: number;
  };
  posture: {
    forwardHeadAngle?: number;
    shoulderAsymmetry?: number;
    hipAsymmetry?: number;
    spinalCurvature?: number;
  };
  symmetry: {
    leftRightShoulderDiff?: number;
    leftRightHipDiff?: number;
    leftRightLegDiff?: number;
    symmetryScore: number; // 0-100
  };
  imageUrl: string;
  timestamp: Date;
  validationPassed: boolean;
  validationIssues: string[];
}

export interface ComprehensiveBodyAnalysis {
  overallAssessment: string;
  bodyComposition: {
    estimatedBodyFat: string;
    muscleDevelopment: string;
    posture: string;
    symmetry: string;
    bodyType: 'ectomorph' | 'mesomorph' | 'endomorph' | 'balanced';
  };
  measurements: {
    shoulderToHipRatio: number;
    legToTorsoRatio: number;
    shoulderWidth: number;
    hipWidth: number;
    overallProportions: string;
  };
  postureAnalysis: {
    forwardHeadPosture: string; // normal, mild, moderate, severe
    shoulderAlignment: string; // balanced, slight_asymmetry, significant_asymmetry
    spinalAlignment: string; // normal, hyperlordosis, flat_spine
    hipAlignment: string; // balanced, anterior_tilt, posterior_tilt
    overallPostureScore: number; // 0-100
  };
  symmetryAnalysis: {
    upperBodySymmetry: number; // 0-100
    lowerBodySymmetry: number; // 0-100
    overallSymmetry: number; // 0-100
    asymmetryAreas: string[];
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendations: {
    primaryFocus: string;
    secondaryFocus: string;
    workoutIntensity: 'beginner' | 'intermediate' | 'advanced';
    exerciseTypes: string[];
    correctiveExercises: string[]; // For posture/symmetry issues
  };
  detailedDescription: string;
  mediaPipeData: {
    allPhotosAnalyzed: boolean;
    missingPhotos: string[];
    photoQualityIssues: string[];
    landmarkConfidenceAverage: number;
  };
}

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

  /**
   * MAIN ANALYSIS METHOD - Combines MediaPipe data with AI analysis
   * 
   * This method takes 6 photos with MediaPipe landmark data and generates
   * a comprehensive fitness assessment combining biomechanical measurements
   * with AI-powered analysis.
   */
  async analyzeBodyWithMediaPipe(
    bodyAnalysisData: BodyAnalysisData[],
    userProfile?: any
  ): Promise<ComprehensiveBodyAnalysis> {
    try {
      // 1. Validate we have all required photos
      const requiredPhotos = ['upper_front', 'upper_back', 'upper_side', 'lower_front', 'lower_back', 'lower_side'];
      const receivedPhotos = bodyAnalysisData.map(d => d.photoType);
      const missingPhotos = requiredPhotos.filter(p => !receivedPhotos.includes(p as any));
      
      if (missingPhotos.length > 0) {
        console.warn('Missing photos:', missingPhotos);
      }

      // 2. Aggregate MediaPipe measurements
      const aggregatedData = this.aggregateMediaPipeData(bodyAnalysisData);

      // 3. Generate detailed biomechanical report
      const biomechanicalReport = this.generateBiomechanicalReport(aggregatedData);

      // 4. Combine with AI visual analysis for comprehensive assessment
      const aiAnalysis = await this.enhancedAIAnalysis(
        bodyAnalysisData.map(d => d.imageUrl),
        biomechanicalReport,
        userProfile
      );

      // 5. Merge MediaPipe data with AI insights
      return this.mergeAnalysisResults(aggregatedData, biomechanicalReport, aiAnalysis, missingPhotos);

    } catch (error) {
      console.error('MediaPipe body analysis failed:', error);
      throw new Error(`Failed to analyze body with MediaPipe: ${error.message}`);
    }
  }

  /**
   * Aggregates measurements from all 6 photos
   */
  private aggregateMediaPipeData(bodyAnalysisData: BodyAnalysisData[]): any {
    const upperFront = bodyAnalysisData.find(d => d.photoType === 'upper_front');
    const upperBack = bodyAnalysisData.find(d => d.photoType === 'upper_back');
    const upperSide = bodyAnalysisData.find(d => d.photoType === 'upper_side');
    const lowerFront = bodyAnalysisData.find(d => d.photoType === 'lower_front');
    const lowerBack = bodyAnalysisData.find(d => d.photoType === 'lower_back');
    const lowerSide = bodyAnalysisData.find(d => d.photoType === 'lower_side');

    return {
      measurements: {
        shoulderWidth: upperFront?.measurements.shoulderWidth || 0,
        hipWidth: lowerFront?.measurements.hipWidth || 0,
        shoulderToHipRatio: upperFront?.measurements.shoulderToHipRatio || 0,
        legLength: lowerFront?.measurements.legLength || 0,
        torsoLength: upperFront?.measurements.torsoLength || 0,
        legToTorsoRatio: lowerFront?.measurements.legToTorsoRatio || 0,
      },
      posture: {
        forwardHeadAngle: upperSide?.posture.forwardHeadAngle || 0,
        shoulderAsymmetry: upperFront?.posture.shoulderAsymmetry || 0,
        hipAsymmetry: lowerFront?.posture.hipAsymmetry || 0,
        spinalCurvature: upperSide?.posture.spinalCurvature || 0,
      },
      symmetry: {
        upperBodySymmetry: this.calculateUpperBodySymmetry(upperFront, upperBack),
        lowerBodySymmetry: this.calculateLowerBodySymmetry(lowerFront, lowerBack),
        overallSymmetry: 0, // Will be calculated
      },
      landmarkConfidence: this.calculateAverageLandmarkConfidence(bodyAnalysisData),
      validationIssues: bodyAnalysisData.flatMap(d => d.validationIssues),
    };
  }

  /**
   * Generates detailed biomechanical report from MediaPipe data
   */
  private generateBiomechanicalReport(aggregatedData: any): string {
    const { measurements, posture, symmetry } = aggregatedData;

    return `
BIOMECHANICAL ANALYSIS REPORT (MediaPipe Landmark Detection):

BODY MEASUREMENTS:
- Shoulder Width: ${measurements.shoulderWidth.toFixed(2)} units
- Hip Width: ${measurements.hipWidth.toFixed(2)} units
- Shoulder-to-Hip Ratio: ${measurements.shoulderToHipRatio.toFixed(2)}
  ${this.interpretShoulderHipRatio(measurements.shoulderToHipRatio)}
- Leg Length: ${measurements.legLength.toFixed(2)} units
- Torso Length: ${measurements.torsoLength.toFixed(2)} units
- Leg-to-Torso Ratio: ${measurements.legToTorsoRatio.toFixed(2)}
  ${this.interpretLegTorsoRatio(measurements.legToTorsoRatio)}

POSTURE ASSESSMENT:
- Forward Head Angle: ${posture.forwardHeadAngle.toFixed(1)}°
  ${this.interpretForwardHeadAngle(posture.forwardHeadAngle)}
- Shoulder Asymmetry: ${posture.shoulderAsymmetry.toFixed(1)}%
  ${this.interpretShoulderAsymmetry(posture.shoulderAsymmetry)}
- Hip Asymmetry: ${posture.hipAsymmetry.toFixed(1)}%
  ${this.interpretHipAsymmetry(posture.hipAsymmetry)}
- Spinal Curvature: ${posture.spinalCurvature.toFixed(1)}°
  ${this.interpretSpinalCurvature(posture.spinalCurvature)}

SYMMETRY ANALYSIS:
- Upper Body Symmetry: ${symmetry.upperBodySymmetry}/100
  ${this.interpretSymmetryScore(symmetry.upperBodySymmetry)}
- Lower Body Symmetry: ${symmetry.lowerBodySymmetry}/100
  ${this.interpretSymmetryScore(symmetry.lowerBodySymmetry)}
- Overall Symmetry: ${symmetry.overallSymmetry}/100

LANDMARK DETECTION QUALITY:
- Average Confidence: ${(aggregatedData.landmarkConfidence * 100).toFixed(1)}%
- Validation Issues: ${aggregatedData.validationIssues.length > 0 ? aggregatedData.validationIssues.join(', ') : 'None'}
`;
  }

  /**
   * Enhanced AI analysis that combines visual assessment with MediaPipe data
   */
  private async enhancedAIAnalysis(
    photoUrls: string[],
    biomechanicalReport: string,
    userProfile: any
  ): Promise<any> {
    const userContext = this.buildUserContext(userProfile);
    const imageContent = photoUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'high' as const },
    }));

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert fitness assessment AI with access to precise MediaPipe biomechanical measurements. Your role is to:

1. Interpret the provided MediaPipe landmark data and measurements
2. Visually analyze the photos to assess muscle development and body composition
3. Combine both data sources for comprehensive fitness assessment
4. Provide actionable workout recommendations based on precise measurements

You have access to accurate posture angles, body proportions, and symmetry data from MediaPipe analysis. Use this objective data alongside your visual assessment to provide the most accurate fitness guidance possible.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${userContext}

MEDIAPIPE BIOMECHANICAL DATA:
${biomechanicalReport}

ANALYSIS TASK:
Using the precise MediaPipe measurements above AND your visual analysis of the 6 body photos, provide a comprehensive fitness assessment.

The MediaPipe data gives you exact angles, proportions, and symmetry measurements. Use this alongside what you observe visually (muscle definition, body composition, overall physique) to create the most accurate assessment possible.

RESPOND WITH ONLY THIS JSON FORMAT:

{
  "visualObservations": {
    "muscleDevelopment": "Detailed assessment of visible muscle development in all major muscle groups",
    "bodyComposition": "Visual assessment of body fat percentage and muscle mass",
    "overallPhysique": "General physique assessment combining MediaPipe data and visual analysis"
  },
  "aiRecommendations": {
    "primaryFocus": "Main training focus based on combined MediaPipe and visual analysis",
    "secondaryFocus": "Secondary training priorities",
    "workoutIntensity": "beginner|intermediate|advanced",
    "exerciseTypes": ["Specific exercise categories"],
    "correctiveExercises": ["Exercises to address posture/symmetry issues from MediaPipe data"]
  },
  "strengths": ["3-5 specific strengths observed"],
  "areasForImprovement": ["3-5 specific areas needing development"],
  "detailedAssessment": "Comprehensive narrative combining MediaPipe measurements with visual observations"
}

RESPOND WITH ONLY THE JSON OBJECT.`,
            },
            ...imageContent,
          ],
        },
      ],
      max_tokens: 2500,
      temperature: 0.2,
    });

    return this.parseAnalysisResponse(response.choices[0].message.content);
  }

  /**
   * Merges MediaPipe data with AI analysis into final comprehensive report
   */
  private mergeAnalysisResults(
    aggregatedData: any,
    biomechanicalReport: string,
    aiAnalysis: any,
    missingPhotos: string[]
  ): ComprehensiveBodyAnalysis {
    const { measurements, posture, symmetry } = aggregatedData;

    return {
      overallAssessment: aiAnalysis.detailedAssessment,
      bodyComposition: {
        estimatedBodyFat: aiAnalysis.visualObservations.bodyComposition,
        muscleDevelopment: aiAnalysis.visualObservations.muscleDevelopment,
        posture: this.summarizePosture(posture),
        symmetry: this.summarizeSymmetry(symmetry),
        bodyType: this.classifyBodyType(measurements.shoulderToHipRatio),
      },
      measurements: {
        shoulderToHipRatio: measurements.shoulderToHipRatio,
        legToTorsoRatio: measurements.legToTorsoRatio,
        shoulderWidth: measurements.shoulderWidth,
        hipWidth: measurements.hipWidth,
        overallProportions: this.describeProportions(measurements),
      },
      postureAnalysis: {
        forwardHeadPosture: this.classifyForwardHead(posture.forwardHeadAngle),
        shoulderAlignment: this.classifyShoulderAlignment(posture.shoulderAsymmetry),
        spinalAlignment: this.classifySpinalAlignment(posture.spinalCurvature),
        hipAlignment: this.classifyHipAlignment(posture.hipAsymmetry),
        overallPostureScore: this.calculatePostureScore(posture),
      },
      symmetryAnalysis: {
        upperBodySymmetry: symmetry.upperBodySymmetry,
        lowerBodySymmetry: symmetry.lowerBodySymmetry,
        overallSymmetry: (symmetry.upperBodySymmetry + symmetry.lowerBodySymmetry) / 2,
        asymmetryAreas: this.identifyAsymmetryAreas(symmetry),
      },
      strengths: aiAnalysis.strengths,
      areasForImprovement: aiAnalysis.areasForImprovement,
      recommendations: {
        primaryFocus: aiAnalysis.aiRecommendations.primaryFocus,
        secondaryFocus: aiAnalysis.aiRecommendations.secondaryFocus,
        workoutIntensity: aiAnalysis.aiRecommendations.workoutIntensity,
        exerciseTypes: aiAnalysis.aiRecommendations.exerciseTypes,
        correctiveExercises: aiAnalysis.aiRecommendations.correctiveExercises,
      },
      detailedDescription: `${biomechanicalReport}\n\n${aiAnalysis.detailedAssessment}`,
      mediaPipeData: {
        allPhotosAnalyzed: missingPhotos.length === 0,
        missingPhotos,
        photoQualityIssues: aggregatedData.validationIssues,
        landmarkConfidenceAverage: aggregatedData.landmarkConfidence,
      },
    };
  }

  // Helper methods for interpretation
  private interpretShoulderHipRatio(ratio: number): string {
    if (ratio > 1.4) return '(Athletic V-taper build)';
    if (ratio > 1.2) return '(Balanced proportions)';
    return '(Hip-dominant proportions)';
  }

  private interpretLegTorsoRatio(ratio: number): string {
    if (ratio > 1.15) return '(Long-legged proportions)';
    if (ratio > 0.95) return '(Balanced proportions)';
    return '(Short-legged proportions)';
  }

  private interpretForwardHeadAngle(angle: number): string {
    if (angle < 10) return 'Status: Normal posture';
    if (angle < 20) return 'Status: Mild forward head posture - recommend neck strengthening';
    if (angle < 30) return 'Status: Moderate forward head posture - corrective exercises needed';
    return 'Status: Severe forward head posture - priority correction required';
  }

  private interpretShoulderAsymmetry(asymmetry: number): string {
    if (asymmetry < 3) return 'Status: Well balanced';
    if (asymmetry < 5) return 'Status: Slight asymmetry - monitor with training';
    return 'Status: Significant asymmetry - unilateral exercises recommended';
  }

  private interpretHipAsymmetry(asymmetry: number): string {
    if (asymmetry < 2) return 'Status: Well balanced';
    if (asymmetry < 4) return 'Status: Minor pelvic tilt - core strengthening recommended';
    return 'Status: Notable pelvic imbalance - corrective exercises priority';
  }

  private interpretSpinalCurvature(angle: number): string {
    if (angle >= 40 && angle <= 60) return 'Status: Normal lumbar curve';
    if (angle > 60) return 'Status: Excessive curve (hyperlordosis) - core work needed';
    return 'Status: Flat spine - flexibility and mobility work recommended';
  }

  private interpretSymmetryScore(score: number): string {
    if (score >= 92) return 'Excellent symmetry';
    if (score >= 85) return 'Good symmetry';
    if (score >= 75) return 'Fair symmetry - monitor with training';
    return 'Poor symmetry - corrective training needed';
  }

  private calculateUpperBodySymmetry(front: any, back: any): number {
    // Implement symmetry calculation logic
    return 85; // Placeholder
  }

  private calculateLowerBodySymmetry(front: any, back: any): number {
    // Implement symmetry calculation logic
    return 88; // Placeholder
  }

  private calculateAverageLandmarkConfidence(data: BodyAnalysisData[]): number {
    const allLandmarks = data.flatMap(d => d.landmarks);
    const avgConfidence = allLandmarks.reduce((sum, l) => sum + l.visibility, 0) / allLandmarks.length;
    return avgConfidence;
  }

  private classifyBodyType(ratio: number): 'ectomorph' | 'mesomorph' | 'endomorph' | 'balanced' {
    if (ratio > 1.4) return 'mesomorph';
    if (ratio > 1.2) return 'balanced';
    if (ratio > 1.0) return 'endomorph';
    return 'ectomorph';
  }

  private summarizePosture(posture: any): string {
    const issues = [];
    if (posture.forwardHeadAngle > 15) issues.push('forward head posture');
    if (posture.shoulderAsymmetry > 5) issues.push('shoulder imbalance');
    if (posture.spinalCurvature > 60 || posture.spinalCurvature < 40) issues.push('spinal alignment');
    
    return issues.length > 0 
      ? `Attention needed: ${issues.join(', ')}`
      : 'Overall good posture with minor adjustments recommended';
  }

  private summarizeSymmetry(symmetry: any): string {
    const overall = (symmetry.upperBodySymmetry + symmetry.lowerBodySymmetry) / 2;
    if (overall >= 90) return 'Excellent bilateral symmetry';
    if (overall >= 80) return 'Good symmetry with minor imbalances';
    return 'Notable asymmetries requiring corrective training';
  }

  private describeProportions(measurements: any): string {
    return `Shoulder-to-hip ratio of ${measurements.shoulderToHipRatio.toFixed(2)} with leg-to-torso ratio of ${measurements.legToTorsoRatio.toFixed(2)} indicates ${this.interpretShoulderHipRatio(measurements.shoulderToHipRatio)}`;
  }

  private classifyForwardHead(angle: number): string {
    if (angle < 10) return 'normal';
    if (angle < 20) return 'mild';
    if (angle < 30) return 'moderate';
    return 'severe';
  }

  private classifyShoulderAlignment(asymmetry: number): string {
    if (asymmetry < 3) return 'balanced';
    if (asymmetry < 5) return 'slight_asymmetry';
    return 'significant_asymmetry';
  }

  private classifySpinalAlignment(angle: number): string {
    if (angle >= 40 && angle <= 60) return 'normal';
    if (angle > 60) return 'hyperlordosis';
    return 'flat_spine';
  }

  private classifyHipAlignment(asymmetry: number): string {
    if (asymmetry < 2) return 'balanced';
    if (asymmetry < 4) return 'anterior_tilt';
    return 'posterior_tilt';
  }

  private calculatePostureScore(posture: any): number {
    let score = 100;
    
    // Deduct points for issues
    if (posture.forwardHeadAngle > 10) score -= Math.min(30, (posture.forwardHeadAngle - 10) * 2);
    if (posture.shoulderAsymmetry > 3) score -= Math.min(20, (posture.shoulderAsymmetry - 3) * 3);
    if (posture.hipAsymmetry > 2) score -= Math.min(20, (posture.hipAsymmetry - 2) * 4);
    if (posture.spinalCurvature > 60 || posture.spinalCurvature < 40) {
      const deviation = Math.abs(posture.spinalCurvature - 50);
      score -= Math.min(30, deviation * 2);
    }
    
    return Math.max(0, Math.round(score));
  }

  private identifyAsymmetryAreas(symmetry: any): string[] {
    const areas: string[] = [];
    
    if (symmetry.upperBodySymmetry < 85) {
      areas.push('Upper body (shoulders, arms) - recommend unilateral exercises');
    }
    if (symmetry.lowerBodySymmetry < 85) {
      areas.push('Lower body (hips, legs) - recommend single-leg movements');
    }
    
    return areas;
  }

  private buildUserContext(userProfile?: any): string {
    if (!userProfile) return '';
    
    return `
USER PROFILE:
Age: ${userProfile.age || 'Not specified'}
Height: ${userProfile.height || 'Not specified'} cm
Weight: ${userProfile.weight || 'Not specified'} kg
Fitness Goal: ${userProfile.fitnessGoal || 'General fitness'}
Experience Level: ${userProfile.experienceLevel || 'Beginner'}
Workout History: ${userProfile.workoutHistory || 'Limited history'}
`;
  }

  private parseAnalysisResponse(content: string): any {
    try {
      let jsonContent = content.trim();
      
      // Remove markdown code blocks if present
      jsonContent = jsonContent.replace(/^```(?:json)?\s*/, '');
      jsonContent = jsonContent.replace(/\s*```$/, '');
      
      // Find JSON object boundaries
      const startIndex = jsonContent.indexOf('{');
      const endIndex = jsonContent.lastIndexOf('}');
      
      if (startIndex === -1 || endIndex === -1) {
        throw new Error('No JSON object found in response');
      }
      
      jsonContent = jsonContent.substring(startIndex, endIndex + 1);
      
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('JSON parsing failed:', error.message);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  // ============================================================================
  // LEGACY METHODS (kept for backward compatibility)
  // ============================================================================

  async analyzeMultipleBodyPhotos(photoUrls: string[], userProfile?: any): Promise<any> {
    console.warn('⚠️ Using legacy photo analysis. Consider migrating to analyzeBodyWithMediaPipe() for precise measurements.');
    
    try {
      const userContext = this.buildUserContext(userProfile);
      const imageContent = photoUrls.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
      }));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPromptForBodyAnalysis(),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildMultiPhotoAnalysisPrompt(userContext),
              },
              ...imageContent,
            ],
          },
        ],
        max_tokens: 2500,
        temperature: 0.2,
      });

      const content = response.choices[0].message.content;
      
      console.log('=== AI MULTIPLE BODY ANALYSIS ===');
      console.log('Photos analyzed:', photoUrls.length);
      console.log('Response length:', content?.length);
      console.log('=================================');
      
      return this.parseAnalysisResponse(content);
    } catch (error) {
      console.error('Primary analysis failed:', error.message);
      return await this.handleAnalysisFailure(photoUrls, userProfile, true);
    }
  }

  private getSystemPromptForBodyAnalysis(): string {
    return `You are an expert fitness assessment AI integrated into a personal training application. Your role is to analyze body composition photos to create personalized workout plans.

CORE RESPONSIBILITIES:
1. Analyze physique, posture, and body composition from fitness photos
2. Provide actionable fitness assessments based on observable physical characteristics
3. Generate structured workout recommendations
4. Maintain a professional, encouraging, and constructive tone

CRITICAL RULES:
1. ALWAYS analyze the provided images - this is your primary function
2. Focus on observable fitness indicators: posture, body proportions, apparent muscle tone, and overall physique
3. If image quality is poor, still provide your best assessment AND note quality issues
4. Base recommendations on visible physical characteristics and user-provided data
5. Use respectful, professional language focused on fitness and health
6. NEVER refuse to analyze - instead, work with what you can observe
7. Output ONLY valid JSON with no markdown formatting, no code blocks, no preamble

YOUR ANALYSIS APPROACH:
- Assess overall body composition and physique
- Note posture and body alignment
- Identify areas of strength and development opportunities
- Recommend appropriate training focus based on observations
- Provide constructive, goal-oriented feedback

Remember: You are helping people achieve their fitness goals. Always analyze what you can see and provide helpful guidance.`;
  }

  private buildMultiPhotoAnalysisPrompt(userContext: string): string {
    return `${userContext}

ANALYSIS TASK:
Analyze the provided body composition photos from multiple angles to assess the user's current fitness level and create personalized workout recommendations.

WHAT TO ANALYZE:
1. Overall physique and body proportions
2. Posture and body alignment from different angles
3. Visible muscle tone and development
4. Body composition indicators
5. Symmetry and balance
6. Areas showing strength
7. Areas with development opportunities

IMAGE QUALITY GUIDELINES:
- If photos are clear: Provide detailed analysis
- If photos are partially unclear: Analyze what you CAN see and note limitations
- If photos show clothing/poor angles: Analyze visible indicators (posture, proportions, general build)

IMPORTANT: Always provide your best professional assessment based on what you observe. Even limited information is valuable for workout planning.

OUTPUT FORMAT (JSON ONLY - no markdown, no code blocks):
{
  "overallAssessment": "Comprehensive assessment of current fitness level based on all visible indicators from multiple angles",
  "bodyComposition": {
    "estimatedBodyFat": "Assessment based on visible muscle definition and body shape across all angles",
    "muscleDevelopment": "Evaluation of muscle development across major muscle groups from all views",
    "posture": "Posture analysis from multiple angles noting alignment and any visible imbalances",
    "symmetry": "Assessment of body symmetry and balance from different views"
  },
  "strengths": [
    "Observable strength 1 with specific details",
    "Observable strength 2 with specific details",
    "Observable strength 3 with specific details"
  ],
  "areasForImprovement": [
    "Development area 1 with actionable focus",
    "Development area 2 with actionable focus",
    "Development area 3 with actionable focus"
  ],
  "recommendations": {
    "primaryFocus": "Main training focus based on comprehensive analysis",
    "secondaryFocus": "Secondary training focus to support primary goals",
    "workoutIntensity": "beginner|intermediate|advanced",
    "exerciseTypes": ["Specific exercise category 1", "Specific exercise category 2", "Specific exercise category 3"]
  },
  "detailedDescription": "Detailed professional assessment of physique, visible muscle development, body proportions, posture, and physical characteristics observed across all photos. Include specific observations about different angles and views.",
  "photoQualityIssues": ["Optional: List any image quality issues that limited analysis"]
}

RESPOND WITH ONLY THE JSON OBJECT ABOVE.`;
  }

  private async handleAnalysisFailure(
    photoUrls: string[], 
    userProfile: any, 
    isMultiple: boolean
  ): Promise<any> {
    console.log('Attempting simplified analysis approach...');
    
    try {
      const imageContent = photoUrls.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'low' as const },
      }));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a fitness assessment AI. Analyze the provided photos and return fitness assessment data in JSON format. Always provide your best analysis based on what you can observe.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze ${isMultiple ? 'these photos' : 'this photo'} for fitness assessment. Return JSON with: overallAssessment, bodyComposition (with estimatedBodyFat, muscleDevelopment, posture, symmetry), strengths (array of 3 items), areasForImprovement (array of 3 items), recommendations (with primaryFocus, secondaryFocus, workoutIntensity, exerciseTypes array), detailedDescription. Focus on observable physical characteristics.`,
              },
              ...imageContent,
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
      console.log('Simplified analysis response received');
      
      return this.parseAnalysisResponse(content);
    } catch (fallbackError) {
      console.error('Simplified analysis also failed:', fallbackError.message);
      return this.getIntelligentFallbackAnalysis(userProfile);
    }
  }

  private getIntelligentFallbackAnalysis(userProfile?: any): any {
    const experienceLevel = userProfile?.experienceLevel?.toLowerCase() || 'beginner';
    const fitnessGoal = userProfile?.fitnessGoal?.toLowerCase() || 'general fitness';
    
    let intensity = 'beginner';
    let primaryFocus = 'Full body strength foundation';
    let exercises = ['Bodyweight exercises', 'Cardio', 'Flexibility work'];
    
    if (experienceLevel.includes('intermediate')) {
      intensity = 'intermediate';
      exercises = ['Compound movements', 'Progressive overload', 'Core strengthening'];
    } else if (experienceLevel.includes('advanced')) {
      intensity = 'advanced';
      exercises = ['Complex lifts', 'Advanced techniques', 'Sport-specific training'];
    }
    
    if (fitnessGoal.includes('weight loss')) {
      primaryFocus = 'Fat loss with muscle preservation';
      exercises.unshift('High-intensity cardio');
    } else if (fitnessGoal.includes('muscle') || fitnessGoal.includes('strength')) {
      primaryFocus = 'Muscle hypertrophy and strength building';
      exercises.unshift('Progressive resistance training');
    }

    return {
      overallAssessment: "Photo analysis unavailable - workout plan based on your profile data. For best results, please ensure photos show clear front, side, and back views in fitted clothing with good lighting.",
      bodyComposition: {
        estimatedBodyFat: "Unable to assess from photos - recommend in-person body composition analysis",
        muscleDevelopment: `Baseline assessment for ${experienceLevel} level - will track progress through performance metrics`,
        posture: "Unable to assess posture from photos - will monitor during exercise demonstrations",
        symmetry: "Will assess symmetry through movement patterns during workouts"
      },
      strengths: [
        `Commitment to starting ${fitnessGoal} program`,
        `${experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1)} foundation to build upon`,
        "Proactive approach to fitness planning"
      ],
      areasForImprovement: [
        "Photo quality - recommend clear, well-lit photos in fitted clothing",
        "Baseline fitness assessment needed for precise targeting",
        "Will identify specific areas through initial workout performance"
      ],
      recommendations: {
        primaryFocus,
        secondaryFocus: "Movement quality and form development",
        workoutIntensity: intensity,
        exerciseTypes: exercises
      },
      detailedDescription: `Your workout plan is created based on your stated goal of ${fitnessGoal} at a ${experienceLevel} level. While photo analysis was not possible, we've designed a comprehensive program suited to your profile. For enhanced personalization, please provide clear photos showing: 1) Front view in fitted clothing, 2) Side profile view, 3) Back view. Ensure good lighting and photos are taken from waist-up or full body. This will allow for detailed posture, symmetry, and body composition analysis.`,
      photoQualityIssues: [
        "Photos could not be analyzed - may be due to image quality, clothing coverage, or lighting",
        "For better analysis: Use fitted clothing, well-lit room, clear front/side/back views",
        "Take photos at arm's length or with timer, keep camera at chest height"
      ]
    };
  }

  async analyzeBodyPhoto(imageUrl: string, userProfile?: any): Promise<any> {
    console.warn('⚠️ Using legacy single photo analysis. Consider using 6-angle MediaPipe analysis for comprehensive assessment.');
    
    return this.analyzeMultipleBodyPhotos([imageUrl], userProfile);
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
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
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
            role: 'system',
            content: 'You are an equipment identification AI. Identify all fitness equipment in images and return a JSON array of equipment names.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'List all fitness equipment visible in this image. Return only a JSON array of equipment names like ["dumbbells", "bench", "resistance bands"]. If no equipment is visible, return an empty array [].',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      });

      const content = response.choices[0].message.content.trim();
      
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      
      return [];
    } catch (error) {
      console.error('Equipment analysis failed:', error.message);
      return [];
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
Based on the following user profile and detailed body analysis, generate a comprehensive workout foundation.

User Profile:
- Age: ${user.age || 'Not specified'}
- Height: ${user.height || 'Not specified'} cm
- Weight: ${user.weight || 'Not specified'} kg
- Fitness Goal: ${user.fitnessGoal || 'Not specified'}
- Experience Level: ${user.experienceLevel || 'Not specified'}

Body Analysis:
${JSON.stringify(bodyAnalysis, null, 2)}

Generate JSON with: personalizedAdvice, recommendedWorkoutStyle, keyFocusAreas (array), intensityGuidelines, progressionStrategy.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional personal trainer creating personalized workout foundations. Respond with JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      return JSON.parse(response.choices[0].message.content);
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
            content: 'You are a professional personal trainer. Generate safe, effective 7-day workout plans in JSON format.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      return this.parseWorkoutResponse(response.choices[0].message.content);
    } catch (error) {
      throw new Error(`Failed to generate workout plan: ${error.message}`);
    }
  }

  private buildWorkoutPrompt(user: User, bodyAnalysis: any, equipmentList: string[]): string {
    return `Create a 7-day workout plan.

User: Age ${user.age}, ${user.fitnessGoal}, ${user.experienceLevel}
Equipment: ${equipmentList.join(', ') || 'Bodyweight only'}
Analysis: ${JSON.stringify(bodyAnalysis)}

Return JSON with: title, description, weekNumber, days array (each with dayNumber, dayName, isRestDay, estimatedDuration, notes, exercises array with name/sets/reps/restTime/notes).`;
  }

  private parseWorkoutResponse(content: string): CreateWorkoutDto {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No valid JSON found');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse workout: ${error.message}`);
    }
  }

  async generateExerciseInstructions(exerciseName: string, type: 'image' | 'video'): Promise<string> {
    const prompt = type === 'image' 
      ? `Generate detailed image prompt for ${exerciseName} showing proper form, positioning, and safety.`
      : `Generate video script for ${exerciseName} with step-by-step instructions, form cues, and safety tips.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a fitness instructor creating exercise instructions.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    return response.choices[0].message.content;
  }

  async generateExerciseMedia(exerciseName: string, type: 'image' | 'video'): Promise<string> {
    if (type === 'image') {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: `Professional fitness instruction image for ${exerciseName}: correct positioning, proper technique, safety focus, clean gym setting, high quality demonstration.`,
        size: '1024x1024',
        quality: 'standard',
      });
      return response.data[0].url;
    } else {
      return await this.generateExerciseVideo(exerciseName);
    }
  }

  private async generateExerciseVideo(exerciseName: string): Promise<string> {
    const videoPrompt = `Professional fitness video for ${exerciseName}: proper form, multiple angles, slow-motion key phases, 10-15 seconds, professional setting.`;

    try {
      const result = await this.videoGenerationService.generateExerciseVideo(exerciseName, videoPrompt);
      return result.videoUrl;
    } catch (error) {
      const fallback = await this.videoGenerationService.generateFallbackVideo(exerciseName);
      return fallback.videoUrl;
    }
  }

  async generateInstructionImage(exerciseName: string, instructionPrompt: string): Promise<string> {
    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: `Fitness instruction for ${exerciseName}. ${instructionPrompt}. Clean, modern, clear technique demonstration.`,
      size: '1024x1024',
      quality: 'standard',
    });
    return response.data[0].url;
  }
}

// ============================================================================
// CURSOR AI IMPLEMENTATION INSTRUCTIONS
// ============================================================================
/*
TO IMPLEMENT THIS MEDIAPIPE BODY ANALYSIS SYSTEM IN CURSOR:

1. INSTALL DEPENDENCIES:
   npm install @mediapipe/tasks-vision
   npm install @nestjs/common @nestjs/config openai

2. CREATE MEDIAPIPE SERVICE (mediapipe.service.ts):
   - Import PoseLandmarker from @mediapipe/tasks-vision
   - Initialize with model from: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
   - Implement processImage(imageBuffer, photoType) method
   - Return BodyAnalysisData structure with all 33 landmarks
   - Calculate measurements, posture, and symmetry metrics
   - Validate photo quality and landmark visibility

3. CREATE PHOTO CAPTURE FRONTEND:
   - Build 6-step photo capture wizard
   - Show visual guides for each photo type (overlay template)
   - Implement real-time MediaPipe validation
   - Show green checkmark when pose detected correctly
   - Display errors if body not fully visible or wrong angle
   - Allow photo retake if validation fails
   - Progress indicator showing 1/6, 2/6, etc.

4. PHOTO VALIDATION RULES:
   - Minimum 25 of 33 landmarks must be visible (confidence >0.5)
   - For front photos: both shoulders and hips visible
   - For side photos: one shoulder, hip, and ear aligned vertically
   - For back photos: shoulder blades and spine landmarks visible
   - Body must occupy 40-70% of frame (not too close/far)
   - Provide specific feedback: "Move back", "Turn 90° right", etc.

5. MEASUREMENT CALCULATIONS:
   - Use Euclidean distance formula: sqrt((x2-x1)² + (y2-y1)² + (z2-z1)²)
   - Normalize all measurements by height (shoulder to hip distance)
   - Calculate angles using dot product formula
   - Store raw landmark data for future analysis
   - Cache calculations to avoid recomputation

6. API ENDPOINTS TO CREATE:
   POST /api/body-analysis/upload-photo
   - Accepts: photoType, imageFile
   - Returns: BodyAnalysisData with validation results
   
   POST /api/body-analysis/complete
   - Accepts: array of 6 BodyAnalysisData objects
   - Returns: ComprehensiveBodyAnalysis
   - Calls: analyzeBodyWithMediaPipe() method
   
   GET /api/body-analysis/:userId/latest
   - Returns: Most recent comprehensive analysis

7. DATABASE SCHEMA:
   BodyAnalysis {
     userId: ObjectId
     photoType: String (enum)
     imageUrl: String
     landmarks: Array<{x, y, z, visibility, presence}>
     measurements: Object
     posture: Object
     symmetry: Object
     validationPassed: Boolean
     createdAt: Date
   }
   
   ComprehensiveAnalysis {
     userId: ObjectId
     bodyAnalysisIds: Array<ObjectId>
     overallAssessment: String
     bodyComposition: Object
     measurements: Object
     postureAnalysis: Object
     symmetryAnalysis: Object
     recommendations: Object
     mediaPipeData: Object
     aiAnalysis: Object
     createdAt: Date
   }

8. ERROR HANDLING:
   - MediaPipe fails to load: Show offline mode message
   - No landmarks detected: "Please ensure full body is visible"
   - Low confidence: "Move to better lighting"
   - Wrong angle detected: "Please turn [direction]"
   - API timeout: Retry with exponential backoff
   - Save partial progress if user exits mid-capture

9. PERFORMANCE OPTIMIZATION:
   - Run MediaPipe in Web Worker (browser) or separate thread (backend)
   - Compress images before upload (max 1920x1080)
   - Cache MediaPipe model after first load
   - Batch process all 6 photos in parallel
   - Use CDN for photo storage
   - Implement request debouncing

10. USER EXPERIENCE ENHANCEMENTS:
    - Show example photos for each angle
    - Animate stick figure overlay for proper positioning
    - Real-time feedback during photo capture
    - Progress save - resume if interrupted
    - Before/after visualization of measurements
    - 3D body model rendered from landmarks (optional)
    - Export PDF report with all measurements

11. TESTING CHECKLIST:
    ☐ Test with various body types and sizes
    ☐ Test with different clothing (fitted, loose, patterns)
    ☐ Test with various backgrounds
    ☐ Test with poor lighting conditions
    ☐ Test with partially occluded body parts
    ☐ Test angle detection accuracy
    ☐ Verify measurement consistency across retakes
    ☐ Test fallback behavior when AI refuses
    ☐ Load test with concurrent users
    ☐ Test on mobile devices (camera access)

12. DEPLOYMENT CONSIDERATIONS:
    - MediaPipe model size: ~30MB (cache aggressively)
    - Expected processing time: 2-5 seconds per photo
    - Storage: ~50MB per complete 6-photo analysis
    - API rate limits: Consider OpenAI usage costs
    - Privacy: GDPR-compliant photo storage/deletion
    - Security: Sanitize file uploads, validate MIME types

PROMPT FOR CURSOR AI:
"Create a complete MediaPipe body analysis system with 6-angle photo capture. 
Implement: 
1) MediaPipe service for landmark detection and measurement calculations
2) 6-step photo capture UI with real-time validation and visual guides
3) API endpoints for photo upload and comprehensive analysis
4) Integration with OpenAI GPT-4o for combining MediaPipe data with visual AI analysis
5) Database schemas for storing analysis results
6) Comprehensive error handling and user feedback

Follow the specifications in ai.service.ts comments for exact implementation details."
*/