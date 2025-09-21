import { Controller, Get, Put, Body, UseGuards, Request, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/schemas/user.schema';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.sub);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Request() req, @Body() updateData: Partial<User>) {
    return this.usersService.updateProfile(req.user.sub, updateData);
  }

  @Put('body-photo')
  @ApiOperation({ summary: 'Upload body photo' })
  @ApiResponse({ status: 200, description: 'Body photo uploaded successfully' })
  async uploadBodyPhoto(@Request() req, @Body() body: { photoUrl: string; photoType: 'front' | 'back' | 'left' | 'fullBody' }) {
    return this.usersService.uploadBodyPhoto(req.user.sub, body.photoUrl, body.photoType);
  }

  @Put('equipment-photos')
  @ApiOperation({ summary: 'Upload equipment photos' })
  @ApiResponse({ status: 200, description: 'Equipment photos uploaded successfully' })
  async uploadEquipmentPhotos(@Request() req, @Body() body: { photoUrls: string[] }) {
    return this.usersService.uploadEquipmentPhotos(req.user.sub, body.photoUrls);
  }

  @Put('complete-onboarding')
  @ApiOperation({ summary: 'Complete user onboarding' })
  @ApiResponse({ status: 200, description: 'Onboarding completed successfully' })
  async completeOnboarding(@Request() req, @Body() onboardingData: {
    age: number;
    height: number;
    weight: number;
    fitnessGoal: string;
    experienceLevel: string;
    workoutHistory: string;
    bodyPhotos: { front?: string; back?: string; left?: string; fullBody?: string };
    equipmentPhotos: string[];
    selectedEquipment: string[];
  }) {
    return this.usersService.completeOnboarding(req.user.sub, onboardingData);
  }

  @Put('equipment')
  @ApiOperation({ summary: 'Update selected equipment' })
  @ApiResponse({ status: 200, description: 'Equipment updated successfully' })
  async updateEquipment(@Request() req, @Body() body: { equipment: string[] }) {
    return this.usersService.updateSelectedEquipment(req.user.sub, body.equipment);
  }

  @Get('free-trial-status')
  @ApiOperation({ summary: 'Get free trial status' })
  @ApiResponse({ status: 200, description: 'Free trial status retrieved successfully' })
  async getFreeTrialStatus(@Request() req) {
    const isActive = await this.usersService.isFreeTrialActive(req.user.sub);
    const instructionsRemaining = await this.usersService.getFreeTrialInstructionsRemaining(req.user.sub);
    
    return {
      isActive,
      instructionsRemaining,
    };
  }

  // Admin endpoints
  @Get('all')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'All users retrieved successfully' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Put(':id/suspend')
  @ApiOperation({ summary: 'Suspend user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  async suspendUser(@Param('id') userId: string) {
    return this.usersService.suspendUser(userId);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activateUser(@Param('id') userId: string) {
    return this.usersService.activateUser(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('id') userId: string) {
    await this.usersService.deleteUser(userId);
    return { message: 'User deleted successfully' };
  }

  @Get('body-analysis')
  @ApiOperation({ summary: 'Get user body analysis' })
  @ApiResponse({ status: 200, description: 'Body analysis retrieved successfully' })
  async getBodyAnalysis(@Request() req) {
    return this.usersService.getBodyAnalysis(req.user.sub);
  }

  @Get('workout-foundation')
  @ApiOperation({ summary: 'Get user workout foundation' })
  @ApiResponse({ status: 200, description: 'Workout foundation retrieved successfully' })
  async getWorkoutFoundation(@Request() req) {
    return this.usersService.getWorkoutFoundation(req.user.sub);
  }
}
