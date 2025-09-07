import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionPlan } from '../common/schemas/subscription.schema';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get user active subscription' })
  @ApiResponse({ status: 200, description: 'Active subscription retrieved successfully' })
  async getActiveSubscription(@Request() req) {
    return this.subscriptionsService.getUserActiveSubscription(req.user.sub);
  }

  @Post('create')
  @ApiOperation({ summary: 'Create new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async createSubscription(
    @Request() req,
    @Body() body: { plan: SubscriptionPlan; price: number; instructionsLimit: number },
  ) {
    return this.subscriptionsService.createSubscription(
      req.user.sub,
      body.plan,
      body.price,
      body.instructionsLimit,
    );
  }

  @Get('instructions-remaining/:subscriptionId')
  @ApiOperation({ summary: 'Get remaining instructions for subscription' })
  @ApiResponse({ status: 200, description: 'Remaining instructions retrieved successfully' })
  async getInstructionsRemaining(@Param('subscriptionId') subscriptionId: string) {
    const remaining = await this.subscriptionsService.getInstructionsRemaining(subscriptionId);
    return { remaining };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully' })
  async cancelSubscription(
    @Param('id') subscriptionId: string,
    @Body() body: { reason?: string },
  ) {
    return this.subscriptionsService.cancelSubscription(subscriptionId, body.reason);
  }

  // Admin endpoints
  @Get('all')
  @ApiOperation({ summary: 'Get all subscriptions (Admin only)' })
  @ApiResponse({ status: 200, description: 'All subscriptions retrieved successfully' })
  async getAllSubscriptions() {
    return this.subscriptionsService.getAllSubscriptions();
  }
}
