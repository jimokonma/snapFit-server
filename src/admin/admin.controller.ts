import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Full dashboard overview' })
  async getDashboard() {
    return this.adminService.getDashboardOverview();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'App analytics (alias for dashboard)' })
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  // ── Config ────────────────────────────────────────────────────────────────

  @Get('config')
  async getAllConfigs() {
    return this.adminService.getAllConfigs();
  }

  @Post('config')
  async setConfig(@Body() body: { key: string; value: any; description?: string }) {
    return this.adminService.setConfig(body.key, body.value, body.description);
  }

  @Put('pricing')
  async updatePricing(@Body() body: { plan: string; price: number }) {
    await this.adminService.updatePricing(body.plan, body.price);
    return { message: 'Pricing updated' };
  }

  @Put('instructions-limit')
  async updateInstructionsLimit(@Body() body: { plan: string; limit: number }) {
    await this.adminService.updateInstructionsLimit(body.plan, body.limit);
    return { message: 'Instructions limit updated' };
  }

  @Put('free-trial')
  async updateFreeTrial(@Body() body: { days?: number; instructions?: number }) {
    if (body.days !== undefined) await this.adminService.updateFreeTrialDays(body.days);
    if (body.instructions !== undefined) await this.adminService.updateFreeTrialInstructions(body.instructions);
    return { message: 'Free trial settings updated' };
  }

  // ── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'Get all users (paginated + searchable)' })
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(Number(page), Number(limit), search);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get full user detail' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban a user' })
  async banUser(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.adminService.banUser(id, body.reason);
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: 'Unban a user' })
  async unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user and all their data' })
  async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { message: 'User deleted' };
  }

  @Post('users/:id/premium')
  @ApiOperation({ summary: 'Grant premium access to a user' })
  async grantPremium(
    @Param('id') id: string,
    @Body() body: { tier: 'pro' | 'elite'; days?: number },
  ) {
    return this.adminService.grantPremium(id, body.tier, body.days);
  }

  @Post('users/:id/notify')
  @ApiOperation({ summary: 'Send push notification to a specific user' })
  async notifyUser(
    @Param('id') id: string,
    @Body() body: { title: string; body: string; data?: Record<string, any> },
  ) {
    const sent = await this.adminService.sendPushNotification(id, body.title, body.body, body.data);
    return { sent, message: sent ? 'Notification sent' : 'Failed to send' };
  }

  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'Broadcast push notification to all users' })
  async broadcast(@Body() body: { title: string; body: string; data?: Record<string, any> }) {
    const count = await this.adminService.broadcastPushNotification(body.title, body.body, body.data);
    return { sent: count, message: `Notification sent to ${count} users` };
  }

  @Post('users/push-token')
  @ApiOperation({ summary: 'Save push token (called from mobile on login)' })
  async savePushToken(@Body() body: { userId: string; token: string }) {
    await this.adminService.savePushToken(body.userId, body.token);
    return { message: 'Push token saved' };
  }

  // ── AI Tokens ────────────────────────────────────────────────────────────

  @Get('tokens')
  @ApiOperation({ summary: 'AI token usage stats' })
  async getTokenStats(@Query('days') days = '30') {
    return this.adminService.getTokenStats(Number(days));
  }

  @Get('tokens/users/:userId')
  @ApiOperation({ summary: 'AI token usage for a specific user' })
  async getUserTokens(@Param('userId') userId: string, @Query('days') days = '30') {
    return this.adminService.getUserTokenDetail(userId, Number(days));
  }

  // ── Errors ───────────────────────────────────────────────────────────────

  @Get('errors')
  @ApiOperation({ summary: 'Get error logs' })
  async getErrors(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('level') level?: string,
    @Query('endpoint') endpoint?: string,
  ) {
    return this.adminService.getErrorLogs(Number(page), Number(limit), level, endpoint);
  }

  @Delete('errors')
  @ApiOperation({ summary: 'Clear all error logs' })
  async clearAllErrors() {
    await this.adminService.clearAllErrors();
    return { message: 'All error logs cleared' };
  }

  @Delete('errors/:id')
  @ApiOperation({ summary: 'Clear a specific error log' })
  async clearError(@Param('id') id: string) {
    await this.adminService.clearError(id);
    return { message: 'Error log cleared' };
  }

  // ── Revenue ──────────────────────────────────────────────────────────────

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue metrics (MRR, ARR, churn, etc.)' })
  async getRevenue(@Query('days') days = '90') {
    return this.adminService.getRevenueMetrics(Number(days));
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'All subscriptions (paginated)' })
  async getSubscriptions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllSubscriptions(Number(page), Number(limit), status);
  }

  @Patch('subscriptions/:id')
  @ApiOperation({ summary: 'Modify a subscription' })
  async modifySubscription(
    @Param('id') id: string,
    @Body() body: { status?: string; endDate?: string; tier?: string },
  ) {
    const updates: any = {};
    if (body.status) updates.status = body.status;
    if (body.endDate) updates.endDate = new Date(body.endDate);
    if (body.tier) updates.tier = body.tier;
    return this.adminService.modifySubscription(id, updates);
  }
}
