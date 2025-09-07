import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get admin analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get all admin configurations' })
  @ApiResponse({ status: 200, description: 'Configurations retrieved successfully' })
  async getAllConfigs() {
    return this.adminService.getAllConfigs();
  }

  @Get('config/:key')
  @ApiOperation({ summary: 'Get specific configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  async getConfig(@Body() body: { key: string }) {
    return this.adminService.getConfig(body.key);
  }

  @Post('config')
  @ApiOperation({ summary: 'Set configuration' })
  @ApiResponse({ status: 201, description: 'Configuration set successfully' })
  async setConfig(@Body() body: { key: string; value: any; description?: string }) {
    return this.adminService.setConfig(body.key, body.value, body.description);
  }

  @Put('pricing')
  @ApiOperation({ summary: 'Update subscription pricing' })
  @ApiResponse({ status: 200, description: 'Pricing updated successfully' })
  async updatePricing(@Body() body: { plan: string; price: number }) {
    await this.adminService.updatePricing(body.plan, body.price);
    return { message: 'Pricing updated successfully' };
  }

  @Put('instructions-limit')
  @ApiOperation({ summary: 'Update instructions limit' })
  @ApiResponse({ status: 200, description: 'Instructions limit updated successfully' })
  async updateInstructionsLimit(@Body() body: { plan: string; limit: number }) {
    await this.adminService.updateInstructionsLimit(body.plan, body.limit);
    return { message: 'Instructions limit updated successfully' };
  }

  @Put('free-trial')
  @ApiOperation({ summary: 'Update free trial settings' })
  @ApiResponse({ status: 200, description: 'Free trial settings updated successfully' })
  async updateFreeTrial(@Body() body: { days?: number; instructions?: number }) {
    if (body.days !== undefined) {
      await this.adminService.updateFreeTrialDays(body.days);
    }
    if (body.instructions !== undefined) {
      await this.adminService.updateFreeTrialInstructions(body.instructions);
    }
    return { message: 'Free trial settings updated successfully' };
  }
}
