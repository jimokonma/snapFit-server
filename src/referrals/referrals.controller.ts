import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-code')
  @ApiOperation({ summary: 'Get current user referral code and link' })
  async getMyCode(@Request() req) {
    return this.referralsService.getReferralCode(req.user.sub);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get referral stats for current user' })
  async getStats(@Request() req) {
    return this.referralsService.getUserReferralStats(req.user.sub);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply a referral code (called on signup if code provided)' })
  async applyCode(@Request() req, @Body() body: { code: string }) {
    await this.referralsService.applyReferralCode(req.user.sub, body.code);
    return { message: 'Referral code applied' };
  }

  // Admin
  @Get('admin/all')
  @ApiOperation({ summary: 'Get all referrals (Admin only)' })
  async getAllReferrals() {
    return this.referralsService.getAllReferrals();
  }
}
