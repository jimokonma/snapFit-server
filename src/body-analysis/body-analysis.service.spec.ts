import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BodyAnalysisService } from './body-analysis.service';
import { MediaPipeService } from '../mediapipe/mediapipe.service';
import { MediaService } from '../media/media.service';
import { AiService } from '../ai/ai.service';
import { BodyAnalysis, PhotoType } from '../common/schemas/body-analysis.schema';
import { ComprehensiveAnalysis } from '../common/schemas/comprehensive-analysis.schema';
import { User } from '../common/schemas/user.schema';

describe('BodyAnalysisService', () => {
  let service: BodyAnalysisService;
  let bodyAnalysisModel: any;
  let comprehensiveAnalysisModel: any;
  let userModel: any;
  let mediaPipeService: any;
  let mediaService: any;
  let aiService: any;

  const mockBodyAnalysisModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  };

  const mockComprehensiveAnalysisModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockMediaPipeService = {
    processPreComputedLandmarks: jest.fn(),
  };

  const mockMediaService = {
    uploadImage: jest.fn(),
    deleteMedia: jest.fn(),
  };

  const mockAiService = {
    analyzeBodyWithMediaPipe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BodyAnalysisService,
        {
          provide: getModelToken(BodyAnalysis.name),
          useValue: mockBodyAnalysisModel,
        },
        {
          provide: getModelToken(ComprehensiveAnalysis.name),
          useValue: mockComprehensiveAnalysisModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: MediaPipeService,
          useValue: mockMediaPipeService,
        },
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<BodyAnalysisService>(BodyAnalysisService);
    bodyAnalysisModel = module.get(getModelToken(BodyAnalysis.name));
    comprehensiveAnalysisModel = module.get(getModelToken(ComprehensiveAnalysis.name));
    userModel = module.get(getModelToken(User.name));
    mediaPipeService = module.get(MediaPipeService);
    mediaService = module.get(MediaService);
    aiService = module.get(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadPhoto', () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      size: 1024,
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const mockUserId = 'user123';
    const mockPhotoType: PhotoType = PhotoType.UPPER_FRONT;
    const mockLandmarks = [
      { x: 0.5, y: 0.5, z: 0, visibility: 0.9, presence: 0.9 },
    ];

    it('should upload photo successfully', async () => {
      const mockImageUrl = 'https://cloudinary.com/image.jpg';
      const mockBodyAnalysisData = {
        photoType: mockPhotoType,
        landmarks: mockLandmarks,
        worldLandmarks: mockLandmarks,
        measurements: {},
        posture: {},
        symmetry: { symmetryScore: 90 },
        imageUrl: mockImageUrl,
        timestamp: new Date(),
        validationPassed: true,
        validationIssues: [],
      };

      mockBodyAnalysisModel.findOne.mockResolvedValue(null);
      mockMediaService.uploadImage.mockResolvedValue(mockImageUrl);
      mockMediaPipeService.processPreComputedLandmarks.mockResolvedValue(mockBodyAnalysisData);
      mockBodyAnalysisModel.create.mockResolvedValue(mockBodyAnalysisData);

      const result = await service.uploadPhoto(mockUserId, mockFile, mockPhotoType, mockLandmarks);

      expect(result).toEqual(mockBodyAnalysisData);
      expect(mockMediaService.uploadImage).toHaveBeenCalled();
      expect(mockMediaPipeService.processPreComputedLandmarks).toHaveBeenCalled();
    });

    it('should throw error for invalid photo type', async () => {
      await expect(
        service.uploadPhoto(mockUserId, mockFile, 'invalid_type' as PhotoType, [])
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid file', async () => {
      await expect(
        service.uploadPhoto(mockUserId, null as any, mockPhotoType, [])
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for file size exceeding limit', async () => {
      const largeFile = { ...mockFile, size: 11 * 1024 * 1024 };
      await expect(
        service.uploadPhoto(mockUserId, largeFile, mockPhotoType, [])
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeAnalysis', () => {
    const mockUserId = 'user123';
    const mockUser = {
      _id: mockUserId,
      age: 25,
      height: 175,
      weight: 70,
      fitnessGoal: 'muscle_gain',
      experienceLevel: 'intermediate',
      workoutHistory: '1-3_years',
    };

    const mockBodyAnalyses = [
      {
        _id: 'analysis1',
        photoType: PhotoType.UPPER_FRONT,
        landmarks: [],
        worldLandmarks: [],
        measurements: {},
        posture: {},
        symmetry: { symmetryScore: 90 },
        imageUrl: 'https://cloudinary.com/image1.jpg',
        createdAt: new Date(),
        validationPassed: true,
        validationIssues: [],
      },
    ];

    const mockComprehensiveAnalysis = {
      overallAssessment: 'Good fitness level',
      bodyComposition: {
        estimatedBodyFat: '15%',
        muscleDevelopment: 'Good',
        posture: 'Normal',
        symmetry: 'Excellent',
        bodyType: 'mesomorph' as const,
      },
      measurements: {
        shoulderToHipRatio: 1.3,
        legToTorsoRatio: 1.1,
        shoulderWidth: 40,
        hipWidth: 30,
        overallProportions: 'Balanced',
      },
      postureAnalysis: {
        forwardHeadPosture: 'normal',
        shoulderAlignment: 'balanced',
        spinalAlignment: 'normal',
        hipAlignment: 'balanced',
        overallPostureScore: 85,
      },
      symmetryAnalysis: {
        upperBodySymmetry: 90,
        lowerBodySymmetry: 88,
        overallSymmetry: 89,
        asymmetryAreas: [],
      },
      strengths: ['Good posture', 'Balanced proportions'],
      areasForImprovement: ['Increase muscle mass'],
      recommendations: {
        primaryFocus: 'Muscle building',
        secondaryFocus: 'Strength training',
        workoutIntensity: 'intermediate' as const,
        exerciseTypes: ['Weight training'],
        correctiveExercises: [],
      },
      detailedDescription: 'Overall good fitness level',
      mediaPipeData: {
        allPhotosAnalyzed: false,
        missingPhotos: ['upper_back'],
        photoQualityIssues: [],
        landmarkConfidenceAverage: 0.9,
      },
    };

    it('should complete analysis successfully', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      // Mock the chained find().sort() call
      const mockQuery = {
        sort: jest.fn().mockResolvedValue(mockBodyAnalyses),
      };
      mockBodyAnalysisModel.find.mockReturnValue(mockQuery);
      mockAiService.analyzeBodyWithMediaPipe.mockResolvedValue(mockComprehensiveAnalysis);
      mockComprehensiveAnalysisModel.create.mockResolvedValue(mockComprehensiveAnalysis);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.completeAnalysis(mockUserId);

      expect(result).toEqual(mockComprehensiveAnalysis);
      expect(mockAiService.analyzeBodyWithMediaPipe).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(service.completeAnalysis(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw error if no photos found', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      // Mock the chained find().sort() call returning empty array
      const mockQuery = {
        sort: jest.fn().mockResolvedValue([]),
      };
      mockBodyAnalysisModel.find.mockReturnValue(mockQuery);

      await expect(service.completeAnalysis(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLatestAnalysis', () => {
    const mockUserId = 'user123';
    const mockAnalysis = {
      _id: 'analysis1',
      userId: mockUserId,
      bodyAnalysisIds: ['id1', 'id2'],
      overallAssessment: 'Good',
    };

    it('should return latest analysis', async () => {
      mockComprehensiveAnalysisModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockAnalysis),
        }),
      });

      const result = await service.getLatestAnalysis(mockUserId);

      expect(result).toEqual(mockAnalysis);
    });

    it('should throw error if no analysis found', async () => {
      mockComprehensiveAnalysisModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getLatestAnalysis(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });
});

