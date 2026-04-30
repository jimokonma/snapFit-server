import { IsString, IsOptional, IsNumber, IsEnum, IsIn } from 'class-validator';
import { FitnessGoal, ExperienceLevel } from '../../common/schemas/user.schema';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female';

  @IsOptional()
  @IsNumber()
  age?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsEnum(FitnessGoal)
  fitnessGoal?: FitnessGoal;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @IsNumber()
  daysPerWeek?: number;

  @IsOptional()
  @IsString()
  injuries?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
