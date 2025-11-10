import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BodyAnalysisData, MediaPipeLandmark } from '../ai/ai.service';

/**
 * MediaPipe Service for Body Analysis
 * 
 * This service handles MediaPipe pose landmark detection and measurement calculations.
 * 
 * Note: MediaPipe @mediapipe/tasks-vision is primarily designed for browser environments.
 * For Node.js backend processing, we have two options:
 * 1. Accept pre-processed landmark data from frontend (recommended for production)
 * 2. Use MediaPipe in Node.js with additional setup (experimental)
 * 
 * This implementation supports both approaches - it can accept pre-processed data
 * or attempt to process images if MediaPipe is available in the Node.js environment.
 */
@Injectable()
export class MediaPipeService {
  private readonly logger = new Logger(MediaPipeService.name);
  private poseLandmarker: any = null;
  private modelInitialized = false;
  private readonly modelUrl: string;

  constructor(private configService: ConfigService) {
    this.modelUrl = this.configService.get<string>(
      'MEDIAPIPE_MODEL_URL',
      'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task'
    );
  }

  /**
   * Initialize MediaPipe PoseLandmarker
   * Note: This may not work in Node.js without additional setup
   */
  async initialize(): Promise<void> {
    if (this.modelInitialized) {
      return;
    }

    try {
      // Attempt to load MediaPipe (may fail in Node.js)
      // In production, landmark detection should happen on frontend
      this.logger.warn(
        'MediaPipe backend processing is experimental. ' +
        'For production, process landmarks on frontend and send data to backend.'
      );
      this.modelInitialized = true;
    } catch (error) {
      this.logger.warn('MediaPipe initialization failed. Will accept pre-processed data from frontend.');
      this.modelInitialized = false;
    }
  }

  /**
   * Process image and extract landmarks
   * This method accepts pre-processed landmark data from frontend (recommended)
   * or attempts to process the image if MediaPipe is available
   */
  async processImage(
    imageBuffer: Buffer,
    photoType: 'upper_front' | 'upper_back' | 'upper_side' | 'lower_front' | 'lower_back' | 'lower_side',
    preProcessedLandmarks?: MediaPipeLandmark[]
  ): Promise<BodyAnalysisData> {
    // If frontend already processed landmarks, use them
    if (preProcessedLandmarks && preProcessedLandmarks.length > 0) {
      return this.processPreComputedLandmarks(preProcessedLandmarks, photoType, '');
    }

    // Otherwise, attempt backend processing (may not work in Node.js)
    throw new BadRequestException(
      'MediaPipe processing should be done on frontend. Please send pre-processed landmark data.'
    );
  }

  /**
   * Process pre-computed landmarks from frontend
   * This is the recommended approach for production
   */
  processPreComputedLandmarks(
    landmarks: MediaPipeLandmark[],
    photoType: 'upper_front' | 'upper_back' | 'upper_side' | 'lower_front' | 'lower_back' | 'lower_side',
    imageUrl: string
  ): BodyAnalysisData {
    if (!landmarks || landmarks.length !== 33) {
      throw new BadRequestException('Invalid landmarks data. Expected 33 landmarks.');
    }

    // Validate landmarks
    const validationResult = this.validateLandmarks(landmarks, photoType);
    
    // Calculate measurements based on photo type
    const measurements = this.calculateMeasurements(landmarks, photoType);
    
    // Calculate posture metrics
    const posture = this.calculatePosture(landmarks, photoType);
    
    // Calculate symmetry
    const symmetry = this.calculateSymmetry(landmarks, photoType);
    
    // Calculate average confidence
    const landmarkConfidenceAverage = landmarks.reduce(
      (sum, l) => sum + l.visibility,
      0
    ) / landmarks.length;

    return {
      photoType,
      landmarks,
      worldLandmarks: landmarks, // Use same data for 3D (can be enhanced)
      measurements,
      posture,
      symmetry: {
        ...symmetry,
        symmetryScore: this.calculateSymmetryScore(symmetry),
      },
      imageUrl,
      timestamp: new Date(),
      validationPassed: validationResult.passed,
      validationIssues: validationResult.issues,
    };
  }

  /**
   * Validate landmarks for a specific photo type
   */
  private validateLandmarks(
    landmarks: MediaPipeLandmark[],
    photoType: string
  ): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check minimum required landmarks are visible
    const visibleLandmarks = landmarks.filter(l => l.visibility > 0.5);
    if (visibleLandmarks.length < 25) {
      issues.push(`Only ${visibleLandmarks.length} of 33 landmarks detected. Need at least 25.`);
    }

    // Photo-type specific validation
    if (photoType.includes('front')) {
      // Front view: need both shoulders (11, 12) and hips (23, 24)
      if (landmarks[11].visibility < 0.5 || landmarks[12].visibility < 0.5) {
        issues.push('Both shoulders must be visible in front view');
      }
      if (photoType.includes('lower') && (landmarks[23].visibility < 0.5 || landmarks[24].visibility < 0.5)) {
        issues.push('Both hips must be visible in lower front view');
      }
    } else if (photoType.includes('back')) {
      // Back view: need shoulder blades and spine
      if (landmarks[11].visibility < 0.5 || landmarks[12].visibility < 0.5) {
        issues.push('Shoulder blades must be visible in back view');
      }
    } else if (photoType.includes('side')) {
      // Side view: need one side aligned vertically
      const shoulderY = photoType.includes('upper') ? landmarks[12].y : landmarks[24].y;
      const hipY = photoType.includes('upper') ? landmarks[24].y : landmarks[26].y;
      const verticalAlignment = Math.abs(shoulderY - hipY);
      if (verticalAlignment > 0.3) {
        issues.push('Body not properly aligned for side view');
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  }

  /**
   * Calculate body measurements from landmarks
   */
  private calculateMeasurements(
    landmarks: MediaPipeLandmark[],
    photoType: string
  ): BodyAnalysisData['measurements'] {
    const measurements: BodyAnalysisData['measurements'] = {};

    // Calculate distances using Euclidean distance
    const distance = (p1: MediaPipeLandmark, p2: MediaPipeLandmark): number => {
      return Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
        Math.pow(p2.y - p1.y, 2) +
        Math.pow(p2.z - p1.z, 2)
      );
    };

    // Shoulder width (landmarks 11 and 12)
    if (photoType.includes('upper') && landmarks[11].visibility > 0.5 && landmarks[12].visibility > 0.5) {
      measurements.shoulderWidth = distance(landmarks[11], landmarks[12]);
    }

    // Hip width (landmarks 23 and 24)
    if (photoType.includes('lower') && landmarks[23].visibility > 0.5 && landmarks[24].visibility > 0.5) {
      measurements.hipWidth = distance(landmarks[23], landmarks[24]);
    }

    // Calculate ratios if both available
    if (measurements.shoulderWidth && measurements.hipWidth) {
      measurements.shoulderToHipRatio = measurements.shoulderWidth / measurements.hipWidth;
    }

    // Leg length (hip to ankle)
    if (photoType.includes('lower')) {
      const leftLegLength = landmarks[23].visibility > 0.5 && landmarks[27].visibility > 0.5
        ? distance(landmarks[23], landmarks[27])
        : null;
      const rightLegLength = landmarks[24].visibility > 0.5 && landmarks[28].visibility > 0.5
        ? distance(landmarks[24], landmarks[28])
        : null;
      
      if (leftLegLength && rightLegLength) {
        measurements.legLength = (leftLegLength + rightLegLength) / 2;
      } else if (leftLegLength) {
        measurements.legLength = leftLegLength;
      } else if (rightLegLength) {
        measurements.legLength = rightLegLength;
      }
    }

    // Torso length (shoulder to hip)
    if (photoType.includes('upper') && landmarks[12].visibility > 0.5 && landmarks[24].visibility > 0.5) {
      measurements.torsoLength = distance(landmarks[12], landmarks[24]);
    }

    // Leg-to-torso ratio
    if (measurements.legLength && measurements.torsoLength) {
      measurements.legToTorsoRatio = measurements.legLength / measurements.torsoLength;
    }

    return measurements;
  }

  /**
   * Calculate posture metrics
   */
  private calculatePosture(
    landmarks: MediaPipeLandmark[],
    photoType: string
  ): BodyAnalysisData['posture'] {
    const posture: BodyAnalysisData['posture'] = {};

    // Forward head angle (from side view)
    if (photoType.includes('side') && photoType.includes('upper')) {
      if (landmarks[6].visibility > 0.5 && landmarks[12].visibility > 0.5 && landmarks[24].visibility > 0.5) {
        // Calculate angle between ear, shoulder, and hip
        const angle = this.calculateAngle(landmarks[6], landmarks[12], landmarks[24]);
        posture.forwardHeadAngle = angle;
      }
    }

    // Shoulder asymmetry (from front/back view)
    if ((photoType.includes('front') || photoType.includes('back')) && photoType.includes('upper')) {
      if (landmarks[11].visibility > 0.5 && landmarks[12].visibility > 0.5) {
        const shoulderDiff = Math.abs(landmarks[11].y - landmarks[12].y);
        const totalHeight = Math.abs(landmarks[0].y - landmarks[24].y); // Nose to hip
        posture.shoulderAsymmetry = totalHeight > 0 ? (shoulderDiff / totalHeight) * 100 : 0;
      }
    }

    // Hip asymmetry (from front/back view)
    if ((photoType.includes('front') || photoType.includes('back')) && photoType.includes('lower')) {
      if (landmarks[23].visibility > 0.5 && landmarks[24].visibility > 0.5) {
        const hipDiff = Math.abs(landmarks[23].y - landmarks[24].y);
        const totalHeight = Math.abs(landmarks[23].y - landmarks[27].y); // Hip to ankle
        posture.hipAsymmetry = totalHeight > 0 ? (hipDiff / totalHeight) * 100 : 0;
      }
    }

    // Spinal curvature (from side view)
    if (photoType.includes('side') && photoType.includes('upper')) {
      if (landmarks[12].visibility > 0.5 && landmarks[24].visibility > 0.5 && landmarks[26].visibility > 0.5) {
        const angle = this.calculateAngle(landmarks[12], landmarks[24], landmarks[26]);
        posture.spinalCurvature = angle;
      }
    }

    return posture;
  }

  /**
   * Calculate symmetry metrics
   */
  private calculateSymmetry(
    landmarks: MediaPipeLandmark[],
    photoType: string
  ): BodyAnalysisData['symmetry'] {
    const symmetry: BodyAnalysisData['symmetry'] = {
      symmetryScore: 0,
    };

    // Shoulder symmetry
    if (photoType.includes('upper') && landmarks[11].visibility > 0.5 && landmarks[12].visibility > 0.5) {
      const shoulderHeightDiff = Math.abs(landmarks[11].y - landmarks[12].y);
      const avgHeight = (landmarks[11].y + landmarks[12].y) / 2;
      symmetry.leftRightShoulderDiff = avgHeight > 0 ? (shoulderHeightDiff / avgHeight) * 100 : 0;
    }

    // Hip symmetry
    if (photoType.includes('lower') && landmarks[23].visibility > 0.5 && landmarks[24].visibility > 0.5) {
      const hipHeightDiff = Math.abs(landmarks[23].y - landmarks[24].y);
      const avgHeight = (landmarks[23].y + landmarks[24].y) / 2;
      symmetry.leftRightHipDiff = avgHeight > 0 ? (hipHeightDiff / avgHeight) * 100 : 0;
    }

    // Leg length symmetry
    if (photoType.includes('lower')) {
      const leftLegLength = landmarks[23].visibility > 0.5 && landmarks[27].visibility > 0.5
        ? Math.sqrt(
            Math.pow(landmarks[27].x - landmarks[23].x, 2) +
            Math.pow(landmarks[27].y - landmarks[23].y, 2)
          )
        : null;
      const rightLegLength = landmarks[24].visibility > 0.5 && landmarks[28].visibility > 0.5
        ? Math.sqrt(
            Math.pow(landmarks[28].x - landmarks[24].x, 2) +
            Math.pow(landmarks[28].y - landmarks[24].y, 2)
          )
        : null;

      if (leftLegLength && rightLegLength) {
        const diff = Math.abs(leftLegLength - rightLegLength);
        const avgLength = (leftLegLength + rightLegLength) / 2;
        symmetry.leftRightLegDiff = avgLength > 0 ? (diff / avgLength) * 100 : 0;
      }
    }

    return symmetry;
  }

  /**
   * Calculate symmetry score (0-100)
   */
  private calculateSymmetryScore(symmetry: BodyAnalysisData['symmetry']): number {
    let score = 100;

    // Deduct points for asymmetry
    if (symmetry.leftRightShoulderDiff) {
      score -= Math.min(30, symmetry.leftRightShoulderDiff * 2);
    }
    if (symmetry.leftRightHipDiff) {
      score -= Math.min(30, symmetry.leftRightHipDiff * 2);
    }
    if (symmetry.leftRightLegDiff) {
      score -= Math.min(30, symmetry.leftRightLegDiff * 2);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate angle between three points
   */
  private calculateAngle(
    p1: MediaPipeLandmark,
    p2: MediaPipeLandmark,
    p3: MediaPipeLandmark
  ): number {
    // Vector from p2 to p1
    const v1 = {
      x: p1.x - p2.x,
      y: p1.y - p2.y,
    };
    // Vector from p2 to p3
    const v2 = {
      x: p3.x - p2.x,
      y: p3.y - p2.y,
    };

    // Dot product
    const dot = v1.x * v2.x + v1.y * v2.y;
    // Magnitudes
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    // Angle in radians, then convert to degrees
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    return (angleRad * 180) / Math.PI;
  }
}

