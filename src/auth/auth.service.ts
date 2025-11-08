import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument } from '../common/schemas/user.schema';
import { RegisterDto, LoginDto, OnboardingDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto, GoogleAuthDto } from '../common/dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/services/email.service';
import { MediaService } from '../media/media.service';
// import { AuditLoggerService, AuditEventType } from '../common/services/audit-logger.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private aiService: AiService,
    private mediaService: MediaService,
    // private auditLogger: AuditLoggerService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ user: User; tokens: any; message: string }> {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification OTP (6 digits)
    const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = new this.userModel({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      emailVerificationToken,
      emailVerificationExpires,
      isEmailVerified: false,
      isActive: true,
      freeTrialStartDate: new Date(),
    });

    const savedUser = await user.save();

    // Send verification email
    await this.emailService.sendVerificationEmail(email, emailVerificationToken);

    // Generate tokens (but user needs to verify email to use them)
    const tokens = await this.generateTokens(savedUser);

    return { 
      user: savedUser, 
      tokens,
      message: 'Registration successful! Please check your email to verify your account.'
    };
  }

  async login(loginDto: LoginDto): Promise<{ user: any; tokens: any }> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Update isActive locally if needed (before generating tokens)
    if (!user.isActive) {
      user.isActive = true;
    }

    // Generate tokens (this will save refreshToken and isActive in a single DB operation)
    const tokens = await this.generateTokens(user);

    // Return only essential user information (no need to fetch again)
    const sanitizedUser = this.getSafeUserData(user);

    return { user: sanitizedUser, tokens };
  }

  async socialLogin(profile: any, provider: string): Promise<{ user: any; tokens: any }> {
    const { id, emails, name } = profile;
    const email = emails[0].value;

    let user = await this.userModel.findOne({ email });

    if (!user) {
      // Create new user
      user = new this.userModel({
        email,
        firstName: name.givenName,
        lastName: name.familyName,
        [`${provider}Id`]: id,
        isEmailVerified: true,
        isActive: true,
        freeTrialStartDate: new Date(),
      });
      user = await user.save();
    } else {
      // Update existing user with social ID
      user[`${provider}Id`] = id;
      user = await user.save();
    }

    const tokens = await this.generateTokens(user);
    const sanitizedUser = this.getSafeUserData(user);
    return { user: sanitizedUser, tokens };
  }

  async completeOnboarding(userId: string, onboardingDto: OnboardingDto): Promise<{ message: string; user: any }> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { ...onboardingDto, hasUsedFreeTrial: true, onboardingCompleted: true },
      { new: true }
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return only safe user data
    const safeUser = this.getSafeUserData(user);

    return {
      message: 'Onboarding completed successfully!',
      user: safeUser
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ tokens: any }> {
    const user = await this.userModel.findOne({ refreshToken });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);
    return { tokens };
  }

  async logout(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
  }

  private async generateTokens(user: UserDocument): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: user._id.toString(), email: user.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    // Update refresh token and ensure user is active in a single database operation
    const updateData: any = { refreshToken };
    if (!user.isActive) {
      updateData.isActive = true;
    }

    await this.userModel.findByIdAndUpdate(user._id, updateData, { new: false });

    return { accessToken, refreshToken };
  }

  private getSafeUserData(user: UserDocument): any {
    return {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted,
      isActive: user.isActive,
      fitnessGoal: user.fitnessGoal,
      experienceLevel: user.experienceLevel,
      onboardingProgress: user.onboardingProgress,
      createdAt: (user as any).createdAt
      // ❌ EXCLUDED SENSITIVE/UNNECESSARY FIELDS:
      // - password (security risk)
      // - refreshToken (should be in tokens object)
      // - freeTrialStartDate (internal tracking)
      // - hasUsedFreeTrial (internal tracking)
      // - freeTrialInstructionsUsed (internal tracking)
      // - age, height, weight (personal data - can be added if needed)
      // - workoutHistory (personal data - can be added if needed)
      // - selectedEquipment (can be added if needed)
      // - equipmentPhotos (sensitive/private)
      // - bodyPhotos (sensitive/private)
      // - gender (personal data - can be added if needed)
      // - bodyAnalysis (detailed analysis - can be added if needed)
      // - workoutFoundation (detailed data - can be added if needed)
      // - emailVerificationToken (verification codes)
      // - emailVerificationExpires (expiration dates)
      // - passwordResetToken (reset codes)
      // - passwordResetExpires (reset expiration)
      // - googleId, facebookId (OAuth IDs)
    };
  }

  async validateUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    // If user is not active, activate them automatically
    if (!user.isActive) {
      user.isActive = true;
      await user.save();
    }
    
    return user;
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const { email, otp } = verifyEmailDto;

    const user = await this.userModel.findOne({
      email: email,
      emailVerificationToken: otp,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.firstName);

    return { message: 'Email verified successfully! Welcome to SnapFit!' };
  }

  async resendVerificationEmail(resendVerificationDto: ResendVerificationDto): Promise<{ message: string }> {
    const { email } = resendVerificationDto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification OTP (6 digits)
    const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save();

    // Send verification email
    await this.emailService.sendVerificationEmail(email, emailVerificationToken);

    return { message: 'Verification email sent successfully!' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return { message: 'If an account with that email exists, we\'ve sent you a password reset code.' };
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.passwordResetToken = otp;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(email, otp);

    return { message: 'If an account with that email exists, we\'ve sent you a password reset code.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { otp, password } = resetPasswordDto;

    const user = await this.userModel.findOne({
      passwordResetToken: otp,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return { message: 'Password reset successfully!' };
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<{ user: User; tokens: any }> {
    const { accessToken } = googleAuthDto;

    try {
      // Verify Google access token and get user info
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
      const googleUser = await response.json();

      if (!googleUser.email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      let user = await this.userModel.findOne({ email: googleUser.email });

      if (!user) {
        // Create new user
        user = new this.userModel({
          email: googleUser.email,
          firstName: googleUser.given_name,
          lastName: googleUser.family_name,
          googleId: googleUser.id,
          isEmailVerified: true, // Google emails are pre-verified
          freeTrialStartDate: new Date(),
        });
        user = await user.save();
      } else {
        // Update existing user with Google ID
        user.googleId = googleUser.id;
        user.isEmailVerified = true; // Ensure email is verified for Google users
        user = await user.save();
      }

      const tokens = await this.generateTokens(user);
      return { user, tokens };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  // Step-by-step onboarding methods
  async saveProfileInfo(userId: string, profileInfoDto: any): Promise<{ message: string; user: any }> {
    const { gender, age, height, weight, experienceLevel, workoutHistory } = profileInfoDto;
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        gender,
        age: parseInt(age),
        height: parseInt(height),
        weight: parseInt(weight),
        experienceLevel,
        workoutHistory,
        onboardingProgress: {
          profileInfoCompleted: true,
          fitnessGoalCompleted: false,
          bodyPhotosCompleted: false,
          equipmentPhotosCompleted: false,
          currentStep: 1,
        },
      },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Profile information saved successfully!',
      user: this.getSafeUserData(user)
    };
  }

  async saveFitnessGoal(userId: string, fitnessGoalDto: any): Promise<{ message: string; user: any }> {
    const { fitnessGoal } = fitnessGoalDto;
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        fitnessGoal,
        onboardingProgress: {
          profileInfoCompleted: true,
          fitnessGoalCompleted: true,
          bodyPhotosCompleted: false,
          equipmentPhotosCompleted: false,
          currentStep: 2,
        },
      },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Fitness goal saved successfully!',
      user: this.getSafeUserData(user)
    };
  }

  async saveBodyPhotos(userId: string, files: Express.Multer.File[]): Promise<{ message: string; user: any; bodyAnalysis?: any }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 4) {
      throw new BadRequestException('Maximum 4 body photos allowed');
    }

    // Upload files to Cloudinary and map them to body photo types
    const uploadPromises = files.map(async (file, index) => {
      const photoType = this.getPhotoTypeFromIndex(index);
      const folder = `snapfit/users/${userId}/body-photos`;
      const url = await this.mediaService.uploadImage(file, folder);
      return { photoType, url };
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Create bodyPhotos object
    const bodyPhotos: { front?: string; back?: string; left?: string; fullBody?: string } = {};
    uploadResults.forEach(({ photoType, url }) => {
      bodyPhotos[photoType] = url;
    });
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        bodyPhotos,
        onboardingProgress: {
          profileInfoCompleted: true,
          fitnessGoalCompleted: true,
          bodyPhotosCompleted: true,
          equipmentPhotosCompleted: false,
          currentStep: 3,
        },
      },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Perform AI body analysis using all available body photos
    let bodyAnalysis = null;
    if (bodyPhotos && (bodyPhotos.front || bodyPhotos.back || bodyPhotos.left || bodyPhotos.fullBody)) {
      try {
        // Analyze all available photos and combine the analysis
        const photoUrls = [
          bodyPhotos.front,
          bodyPhotos.back, 
          bodyPhotos.left,
          bodyPhotos.fullBody
        ].filter(url => url); // Remove undefined URLs

        if (photoUrls.length > 0) {
          console.log('=== RE-ANALYZING BODY PHOTOS ===');
          console.log('Photo URLs:', photoUrls);
          console.log('User Profile:', {
            age: user.age,
            height: user.height,
            weight: user.weight,
            fitnessGoal: user.fitnessGoal,
            experienceLevel: user.experienceLevel,
            workoutHistory: user.workoutHistory
          });
          
          // Analyze all available photos for comprehensive analysis
          bodyAnalysis = await this.aiService.analyzeMultipleBodyPhotos(photoUrls, {
            age: user.age,
            height: user.height,
            weight: user.weight,
            fitnessGoal: user.fitnessGoal,
            experienceLevel: user.experienceLevel,
            workoutHistory: user.workoutHistory
          });

          console.log('=== NEW BODY ANALYSIS RESULT ===');
          console.log('Analysis:', bodyAnalysis);

          // Update user with new body analysis (overwrite existing)
          const updatedUser = await this.userModel.findByIdAndUpdate(userId, {
            bodyAnalysis: {
              ...bodyAnalysis,
              analyzedAt: new Date(),
              analyzedFromPhotos: photoUrls,
              totalPhotosAnalyzed: photoUrls.length
            }
          }, { new: true });

          // Generate new workout foundation based on the updated body analysis
          const workoutFoundation = await this.aiService.generateWorkoutFoundation(updatedUser, bodyAnalysis);
          
          console.log('=== NEW WORKOUT FOUNDATION ===');
          console.log('Foundation:', workoutFoundation);
          
          // Update workout foundation (overwrite existing)
          await this.userModel.findByIdAndUpdate(userId, {
            workoutFoundation: {
              ...workoutFoundation,
              generatedAt: new Date()
            }
          });

          console.log('=== ANALYSIS COMPLETE ===');
        }

      } catch (error) {
        console.error('Failed to analyze body photos:', error);
        // Continue without analysis - don't fail the onboarding
      }
    }

    // Get the final updated user data
    const finalUser = await this.userModel.findById(userId);

    return {
      message: 'Body photos uploaded and saved successfully!' + (bodyAnalysis ? ' AI analysis completed!' : ''),
      user: this.getSafeUserData(finalUser),
      bodyAnalysis: bodyAnalysis
    };
  }

  private getPhotoTypeFromIndex(index: number): 'front' | 'back' | 'left' | 'fullBody' {
    const types: ('front' | 'back' | 'left' | 'fullBody')[] = ['front', 'back', 'left', 'fullBody'];
    return types[index];
  }

  async saveEquipmentSelection(userId: string, equipmentSelectionDto: any): Promise<{ message: string; user: any }> {
    const { selectedEquipment } = equipmentSelectionDto;
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        selectedEquipment,
        onboardingCompleted: true,
        onboardingProgress: {
          profileInfoCompleted: true,
          fitnessGoalCompleted: true,
          bodyPhotosCompleted: true,
          equipmentPhotosCompleted: true,
          currentStep: 4,
        },
      },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Equipment selection saved successfully! Onboarding completed!',
      user: this.getSafeUserData(user)
    };
  }
}
