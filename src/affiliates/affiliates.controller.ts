import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AffiliatesService } from './affiliates.service';
import { AffiliateCategory } from '../common/schemas/affiliate.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Affiliates')
@Controller('affiliates')
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  // ── Public endpoints ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get active affiliate links (optionally filtered by category)' })
  async getActive(@Query('category') category?: AffiliateCategory) {
    return this.affiliatesService.getActiveLinks(category);
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Record a click and return the redirect URL' })
  async recordClick(@Param('id') id: string) {
    return this.affiliatesService.recordClick(id);
  }

  // ── Admin endpoints ───────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all affiliate links including inactive (Admin)' })
  async findAll() {
    return this.affiliatesService.findAll();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create affiliate link (Admin)' })
  async create(
    @Body() body: {
      name: string;
      url: string;
      category: AffiliateCategory;
      description?: string;
      imageUrl?: string;
      displayOrder?: number;
    },
  ) {
    return this.affiliatesService.create(body);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update affiliate link (Admin)' })
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      url: string;
      category: AffiliateCategory;
      description: string;
      imageUrl: string;
      displayOrder: number;
    }>,
  ) {
    return this.affiliatesService.update(id, body);
  }

  @Patch('admin/:id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle active/inactive (Admin)' })
  async toggle(@Param('id') id: string) {
    return this.affiliatesService.toggleActive(id);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete affiliate link (Admin)' })
  async remove(@Param('id') id: string) {
    await this.affiliatesService.remove(id);
    return { message: 'Deleted' };
  }
}
