import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Affiliate, AffiliateDocument, AffiliateCategory } from '../common/schemas/affiliate.schema';

@Injectable()
export class AffiliatesService {
  constructor(
    @InjectModel(Affiliate.name) private affiliateModel: Model<AffiliateDocument>,
  ) {}

  // ── Admin: CRUD ───────────────────────────────────────────────────────

  async create(dto: {
    name: string;
    url: string;
    category: AffiliateCategory;
    description?: string;
    imageUrl?: string;
    displayOrder?: number;
  }): Promise<Affiliate> {
    return this.affiliateModel.create({ ...dto, isActive: true });
  }

  async findAll(): Promise<Affiliate[]> {
    return this.affiliateModel.find().sort({ displayOrder: 1, createdAt: -1 });
  }

  async findById(id: string): Promise<AffiliateDocument> {
    const affiliate = await this.affiliateModel.findById(id);
    if (!affiliate) throw new NotFoundException('Affiliate link not found');
    return affiliate;
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      url: string;
      category: AffiliateCategory;
      description: string;
      imageUrl: string;
      displayOrder: number;
    }>,
  ): Promise<Affiliate> {
    const affiliate = await this.affiliateModel.findByIdAndUpdate(id, dto, { new: true });
    if (!affiliate) throw new NotFoundException('Affiliate link not found');
    return affiliate;
  }

  async remove(id: string): Promise<void> {
    const result = await this.affiliateModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Affiliate link not found');
  }

  // ── Admin: Toggle ─────────────────────────────────────────────────────

  async toggleActive(id: string): Promise<Affiliate> {
    const affiliate = await this.findById(id);
    return this.affiliateModel.findByIdAndUpdate(
      id,
      { isActive: !affiliate.isActive },
      { new: true },
    );
  }

  // ── Public: Get active links ──────────────────────────────────────────

  async getActiveLinks(category?: AffiliateCategory): Promise<Affiliate[]> {
    const filter: any = { isActive: true };
    if (category) filter.category = category;
    return this.affiliateModel.find(filter).sort({ displayOrder: 1 });
  }

  // ── Public: Track click ───────────────────────────────────────────────

  async recordClick(id: string): Promise<{ url: string }> {
    const affiliate = await this.affiliateModel.findByIdAndUpdate(
      id,
      { $inc: { clickCount: 1 } },
      { new: true },
    );
    if (!affiliate) throw new NotFoundException('Affiliate link not found');
    if (!affiliate.isActive) throw new NotFoundException('Affiliate link not found');
    return { url: affiliate.url };
  }
}
