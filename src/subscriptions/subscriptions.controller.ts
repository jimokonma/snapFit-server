import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionTier, BillingCycle } from '../common/schemas/subscription.schema';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get user active subscription' })
  async getActiveSubscription(@Request() req) {
    return this.subscriptionsService.getUserActiveSubscription(req.user.sub);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get current quota usage and limits' })
  async getQuotaStatus(@Request() req) {
    return this.subscriptionsService.getQuotaStatus(req.user.sub);
  }

  @Post('free')
  @ApiOperation({ summary: 'Provision free tier subscription' })
  async createFreeSubscription(@Request() req) {
    return this.subscriptionsService.createFreeSubscription(req.user.sub);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancelSubscription(
    @Param('id') subscriptionId: string,
    @Body() body: { reason?: string },
  ) {
    return this.subscriptionsService.cancelSubscription(subscriptionId, body.reason);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all subscriptions (Admin only)' })
  async getAllSubscriptions() {
    return this.subscriptionsService.getAllSubscriptions();
  }

  @Post('admin/migrate-to-elite')
  @ApiOperation({ summary: 'Migrate all existing users to Elite tier (Admin only, run once)' })
  async migrateToElite() {
    return this.subscriptionsService.migrateAllUsersToElite();
  }
}
