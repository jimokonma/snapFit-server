import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument } from '../common/schemas/user.schema';
import { RegisterDto, LoginDto, OnboardingDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto, GoogleAuthDto, ChangePasswordDto } from '../common/dto/auth.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/services/email.service';
import { decryptField } from '../common/utils/crypto.util';
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
    const hashedPassword = await bcrypt.hash(password, 10);

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

    // Generate tokens (but user needs to verify email to use them)
    const tokens = this.generateTokens(savedUser);

    // Send verification email asynchronously (don't block response)
    console.log(`📧 Registration: Generated OTP for ${email}: ${emailVerificationToken}`);
    console.log(`⏰ OTP expires at: ${emailVerificationExpires}`);
    this.emailService.sendVerificationEmail(email, emailVerificationToken).catch(err => {
      console.error('❌ Background email send failed:', err.message);
      console.error(`📧 OTP for manual verification: ${emailVerificationToken}`);
    });

    return { 
      user: savedUser, 
      tokens,
      message: 'Registration successful! Please check your email to verify your account.'
    };
  }

  async login(loginDto: LoginDto): Promise<{ user: any; tokens: any; requiresEmailVerification?: boolean }> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userModel.findOne({ email });
    if (!user) {
      console.error(`❌ Login failed: User not found for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.error(`❌ Login failed: Invalid password for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.warn(`⚠️  Login: Email not verified for ${email}`);
      console.warn(`📧 Email verification token: ${user.emailVerificationToken}`);
      console.warn(`⏰ Token expires: ${user.emailVerificationExpires}`);
      
      // In development mode, allow login without email verification if SKIP_EMAIL_VERIFICATION is set
      const skipEmailVerification = this.configService.get<string>('SKIP_EMAIL_VERIFICATION') === 'true';
      if (skipEmailVerification && this.configService.get<string>('NODE_ENV') === 'development') {
        console.warn('⚠️  DEVELOPMENT MODE: Allowing login without email verification');
        user.isEmailVerified = true;
        await user.save();
      } else {
        // Return user info but indicate email verification is required
        const sanitizedUser = this.getSafeUserData(user);
        return { 
          user: sanitizedUser, 
          tokens: null,
          requiresEmailVerification: true
        };
      }
    }

    // Update isActive locally if needed (before generating tokens)
    if (!user.isActive) {
      user.isActive = true;
    }

    // Generate tokens (this will save refreshToken and isActive in a single DB operation)
    const tokens = this.generateTokens(user);

    console.log(`✅ Login successful for user: ${email}`);

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

    const tokens = this.generateTokens(user);
    const sanitizedUser = this.getSafeUserData(user);
    return { user: sanitizedUser, tokens };
  }

  async completeOnboarding(userId: string, onboardingDto: OnboardingDto): Promise<{ message: string; user: any }> {
    // Do NOT mark onboardingCompleted here anymore.
    // Only body analysis completion can flip onboardingCompleted.
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { ...onboardingDto, hasUsedFreeTrial: true },
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

    const tokens = this.generateTokens(user);
    return { tokens };
  }

  async logout(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      refreshToken: null,
      $inc: { tokenVersion: 1 },
    });
  }

  private generateTokens(user: UserDocument): { accessToken: string; refreshToken: string } {
    const payload = { sub: user._id.toString(), email: user.email, role: user.role ?? 'user', tokenVersion: user.tokenVersion ?? 0 };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    // Fire-and-forget — client already has the tokens, no need to block on this
    this.userModel.findByIdAndUpdate(user._id, { refreshToken }, { new: false }).exec().catch(() => {});

    return { accessToken, refreshToken };
  }

  private getSafeUserData(user: UserDocument): any {
    return {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted,
      isActive: user.isActive,
      fitnessGoal: user.fitnessGoal,
      experienceLevel: user.experienceLevel,
      onboarding: user.onboarding,
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

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string; user: any }> {
    const { email, otp } = verifyEmailDto;

    const user = await this.userModel.findOne({
      email,
      isEmailVerified: false,
      emailVerificationExpires: { $gt: new Date() },
    });

    const storedToken = user?.emailVerificationToken
      ? decryptField(user.emailVerificationToken)
      : null;

    if (!user || storedToken !== otp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email asynchronously (don't block response)
    this.emailService.sendWelcomeEmail(user.email, user.firstName).catch(err => {
      console.error('Background email send failed:', err.message);
    });

    // Return user data with onboarding progress for navigation
    const sanitizedUser = this.getSafeUserData(user);

    return { 
      message: 'Email verified successfully! Welcome to Gymtedd!',
      user: sanitizedUser
    };
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

    // Send verification email asynchronously (don't block response)
    console.log(`📧 Registration: Generated OTP for ${email}: ${emailVerificationToken}`);
    console.log(`⏰ OTP expires at: ${emailVerificationExpires}`);
    this.emailService.sendVerificationEmail(email, emailVerificationToken).catch(err => {
      console.error('❌ Background email send failed:', err.message);
      console.error(`📧 OTP for manual verification: ${emailVerificationToken}`);
    });

    return { message: 'Verification email sent successfully!' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      console.log(`📧 Password reset requested for non-existent email: ${email}`);
      return { message: 'If an account with that email exists, we\'ve sent you a password reset code.' };
    }

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.passwordResetToken = otp;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    console.log(`📧 Password reset OTP generated for ${email}: ${otp}`);
    console.log(`⏰ OTP expires at: ${passwordResetExpires}`);

    // Send password reset email asynchronously (don't block response)
    this.emailService.sendPasswordResetEmail(email, otp).catch(err => {
      console.error('❌ Background email send failed:', err.message);
      console.error(`📧 Password reset OTP for ${email}: ${otp}`);
    });

    return { message: 'If an account with that email exists, we\'ve sent you a password reset code.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { email, otp, password } = resetPasswordDto;

    const user = await this.userModel.findOne({
      email,
      passwordResetExpires: { $gt: new Date() },
    });

    const storedToken = user?.passwordResetToken
      ? decryptField(user.passwordResetToken)
      : null;

    if (!user || storedToken !== otp) {
      console.error(`❌ Password reset failed: Invalid or expired OTP for email: ${email}`);
      throw new BadRequestException('Invalid or expired reset code. Please request a new code.');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    console.log(`✅ Password reset successful for user: ${email}`);

    return { message: 'Password reset successfully!' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new BadRequestException('Your account uses Google sign-in and does not have a password. Use "Forgot Password" to set one.');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect.');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { message: 'Password changed successfully.' };
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

      const tokens = this.generateTokens(user);
      return { user, tokens };
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  // Step-by-step onboarding methods
  async saveProfileInfo(userId: string, profileInfoDto: any): Promise<{ message: string; user: any }> {
    console.log(`[saveProfileInfo] userId=${userId} dto=${JSON.stringify(profileInfoDto)}`);
    const { gender, age, height, weight, experienceLevel, workoutHistory, daysPerWeek, injuries } = profileInfoDto;

    let user: any;
    try {
      user = await this.userModel.findByIdAndUpdate(
        userId,
        {
          gender,
          age: parseInt(age),
          height: parseInt(height),
          weight: parseInt(weight),
          experienceLevel,
          workoutHistory,
          daysPerWeek: daysPerWeek ? parseInt(daysPerWeek) : undefined,
          injuries: injuries || null,
          onboarding: {
            profileInfo: true,
            fitnessGoal: false,
            bodyAnalysis: false,
          },
        },
        { new: true }
      );
      console.log(`[saveProfileInfo] update OK, user found: ${!!user}`);
    } catch (err: any) {
      console.error(`[saveProfileInfo] DB error:`, err?.message, err?.stack);
      throw err;
    }

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
        onboarding: {
          profileInfo: true,
          fitnessGoal: true,
          bodyAnalysis: false,
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

  async saveEquipmentSelection(userId: string, selectedEquipment: string[]): Promise<{ message: string; user: any }> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { selectedEquipment },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Equipment selection saved successfully!',
      user: this.getSafeUserData(user),
    };
  }

  async saveBodyPhotos(userId: string, files: Express.Multer.File[]): Promise<{ message: string; user: any }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 4) {
      throw new BadRequestException('Maximum 4 body photos allowed');
    }

    const photoTypes: ('upper_front' | 'upper_back' | 'side_profile' | 'full_body')[] = ['upper_front', 'upper_back', 'side_profile', 'full_body'];

    const uploadPromises = files.map(async (file, index) => {
      const photoType = photoTypes[index];
      const folder = `Gymtedd/users/${userId}/body-photos`;
      const url = await this.mediaService.uploadImage(file, folder);
      return { photoType, url };
    });

    const uploadResults = await Promise.all(uploadPromises);

    const bodyPhotos: { upper_front?: string; upper_back?: string; side_profile?: string; full_body?: string } = {};
    uploadResults.forEach(({ photoType, url }) => {
      bodyPhotos[photoType] = url;
    });

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { bodyPhotos, 'onboarding.bodyAnalysis': false },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Body photos uploaded successfully. Use /body-analysis/complete to run AI analysis.',
      user: this.getSafeUserData(user),
    };
  }
}
