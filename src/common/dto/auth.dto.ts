import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class OnboardingDto {
  @ApiProperty({ example: 25 })
  @IsOptional()
  age?: number;

  @ApiProperty({ example: 175 })
  @IsOptional()
  height?: number;

  @ApiProperty({ example: 70 })
  @IsOptional()
  weight?: number;

  @ApiProperty({ example: 'muscle_gain' })
  @IsOptional()
  fitnessGoal?: string;

  @ApiProperty({ example: 'beginner' })
  @IsOptional()
  experienceLevel?: string;

  @ApiProperty({ example: 'never' })
  @IsOptional()
  workoutHistory?: string;

  @ApiProperty({ example: ['dumbbells', 'resistance_bands'] })
  @IsOptional()
  selectedEquipment?: string[];
}

// Step-by-step onboarding DTOs
export class ProfileInfoDto {
  @ApiProperty({ example: 'male', enum: ['male', 'female'] })
  @IsString()
  gender: 'male' | 'female';

  @ApiProperty({ example: 25 })
  @IsString()
  age: string;

  @ApiProperty({ example: 175 })
  @IsString()
  height: string;

  @ApiProperty({ example: 70 })
  @IsString()
  weight: string;
}

export class FitnessGoalDto {
  @ApiProperty({ example: 'muscle_gain' })
  @IsString()
  fitnessGoal: string;
}

export class BodyPhotosDto {
  @ApiProperty({ example: { front: 'url1', back: 'url2', left: 'url3' } })
  @IsOptional()
  bodyPhotos?: {
    front?: string;
    back?: string;
    left?: string;
    fullBody?: string;
  };
}

export class EquipmentPhotosDto {
  @ApiProperty({ example: ['url1', 'url2', 'url3'] })
  @IsOptional()
  equipmentPhotos?: string[];

  @ApiProperty({ example: ['dumbbells', 'resistance_bands'] })
  @IsOptional()
  selectedEquipment?: string[];
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'verification-token-here' })
  @IsString()
  token: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  otp: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;
}

export class GoogleAuthDto {
  @ApiProperty({ example: 'google-access-token' })
  @IsString()
  accessToken: string;
}