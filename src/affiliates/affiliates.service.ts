import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Affiliate, AffiliateDocument, AffiliateCategory } from '../common/schemas/affiliate.schema';
import { AffiliateSettings, AffiliateSettingsDocument } from '../common/schemas/affiliate-settings.schema';

@Injectable()
export class AffiliatesService {
  constructor(
    @InjectModel(Affiliate.name) private affiliateModel: Model<AffiliateDocument>,
    @InjectModel(AffiliateSettings.name) private settingsModel: Model<AffiliateSettingsDocument>,
  ) {}

  private async getSettings(): Promise<AffiliateSettingsDocument> {
    return this.settingsModel.findOneAndUpdate(
      {},
      { $setOnInsert: { enabled: true } },
      { upsert: true, new: true },
    );
  }

  // ── Admin: Global feature toggle ──────────────────────────────────────

  async getFeatureStatus(): Promise<{ enabled: boolean }> {
    const settings = await this.getSettings();
    return { enabled: settings.enabled };
  }

  async setFeatureStatus(enabled: boolean): Promise<{ enabled: boolean }> {
    const settings = await this.settingsModel.findOneAndUpdate(
      {},
      { enabled },
      { upsert: true, new: true },
    );
    return { enabled: settings.enabled };
  }

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

  // ── Admin: Per-link toggle ────────────────────────────────────────────

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
    const settings = await this.getSettings();
    if (!settings.enabled) return [];
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
