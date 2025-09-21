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

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
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

  async login(loginDto: LoginDto): Promise<{ user: User; tokens: any }> {
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

    // Ensure user is active
    if (!user.isActive) {
      user.isActive = true;
      await user.save();
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return { user, tokens };
  }

  async socialLogin(profile: any, provider: string): Promise<{ user: User; tokens: any }> {
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
    return { user, tokens };
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

    // Save refresh token to user
    await this.userModel.findByIdAndUpdate(user._id, { refreshToken });

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
      freeTrialStartDate: user.freeTrialStartDate,
      hasUsedFreeTrial: user.hasUsedFreeTrial,
      freeTrialInstructionsUsed: user.freeTrialInstructionsUsed,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
      // Onboarding data
      age: user.age,
      experienceLevel: user.experienceLevel,
      fitnessGoal: user.fitnessGoal,
      height: user.height,
      weight: user.weight,
      workoutHistory: user.workoutHistory,
      selectedEquipment: user.selectedEquipment,
      equipmentPhotos: user.equipmentPhotos,
      bodyPhotos: user.bodyPhotos,
      gender: user.gender,
      onboardingProgress: user.onboardingProgress
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
    const { token } = verifyEmailDto;

    const user = await this.userModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
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
    const { gender, age, height, weight } = profileInfoDto;
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        gender,
        age: parseInt(age),
        height: parseInt(height),
        weight: parseInt(weight),
        onboardingProgress: {
          profileInfoCompleted: true,
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

  async saveBodyPhotos(userId: string, bodyPhotosDto: any): Promise<{ message: string; user: any }> {
    const { bodyPhotos } = bodyPhotosDto;
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        bodyPhotos,
        onboardingProgress: {
          profileInfoCompleted: true,
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

    return {
      message: 'Body photos saved successfully!',
      user: this.getSafeUserData(user)
    };
  }

  async saveEquipmentPhotos(userId: string, equipmentPhotosDto: any): Promise<{ message: string; user: any }> {
    const { equipmentPhotos, selectedEquipment } = equipmentPhotosDto;
    
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        equipmentPhotos,
        selectedEquipment,
        onboardingCompleted: true,
        onboardingProgress: {
          profileInfoCompleted: true,
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
      message: 'Equipment photos saved successfully! Onboarding completed!',
      user: this.getSafeUserData(user)
    };
  }
}
