import {
  Controller, Post, Get, Body, Query, UseGuards, Request,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class JoinWaitlistBodyDto {
  email: string;
  name?: string;
  source?: string;
  referrer?: string;
}

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join the Gymtedd waitlist' })
  @ApiResponse({ status: 200, description: 'Joined successfully or already on list' })
  async join(@Body() body: JoinWaitlistBodyDto, @Request() req: { headers: { referer?: string } }) {
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw new BadRequestException('A valid email address is required.');
    }
    return this.waitlistService.join({
      email: body.email,
      name: body.name,
      source: body.source,
      referrer: body.referrer ?? req.headers?.referer,
    });
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get waitlist stats (admin)' })
  async stats() {
    return this.waitlistService.getStats();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all waitlist entries (admin)' })
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.waitlistService.getAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
