import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ExerciseDto {
  @ApiProperty({ example: 'Push-ups' })
  @IsString()
  name: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  sets: number;

  @ApiProperty({ example: 12 })
  @IsNumber()
  reps: number;

  @ApiProperty({ example: 60, required: false })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsNumber()
  restTime?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({ example: 'Keep your back straight', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class WorkoutDayDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  dayNumber: number;

  @ApiProperty({ example: 'Monday' })
  @IsString()
  dayName: string;

  @ApiProperty({ example: false })
  @IsOptional()
  isRestDay?: boolean;

  @ApiProperty({ type: [ExerciseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  exercises: ExerciseDto[];

  @ApiProperty({ example: 'Focus on form', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 45, required: false })
  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;
}

export class CreateWorkoutDto {
  @ApiProperty({ example: 'Week 1 - Beginner Strength Training' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'A comprehensive workout plan for beginners', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [WorkoutDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutDayDto)
  days: WorkoutDayDto[];

  @ApiProperty({ example: 1 })
  @IsNumber()
  weekNumber: number;
}

export class GenerateInstructionsDto {
  @ApiProperty({ example: 'Push-ups' })
  @IsString()
  exerciseName: string;

  @ApiProperty({ example: 'image', enum: ['image', 'video'] })
  @IsString()
  type: 'image' | 'video';
}

export class GenerateWorkoutMediaDto {
  @ApiProperty({ example: 'image', enum: ['image', 'video'] })
  @IsString()
  type: 'image' | 'video';

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  forceRegenerate?: boolean;
}

export class GenerateExerciseMediaDto {
  @ApiProperty({ example: '68faebe9fdf0c6ed6ab5446f' })
  @IsString()
  exerciseId: string;

  @ApiProperty({ example: 'image', enum: ['image', 'video'] })
  @IsString()
  type: 'image' | 'video';
}