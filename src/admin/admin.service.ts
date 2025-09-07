import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminConfig, AdminConfigDocument } from '../common/schemas/admin-config.schema';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(AdminConfig.name) private adminConfigModel: Model<AdminConfigDocument>,
    private usersService: UsersService,
    private subscriptionsService: SubscriptionsService,
    private paymentsService: PaymentsService,
  ) {}

  async getConfig(key: string): Promise<any> {
    const config = await this.adminConfigModel.findOne({ key });
    return config ? config.value : null;
  }

  async setConfig(key: string, value: any, description?: string): Promise<AdminConfig> {
    const config = await this.adminConfigModel.findOneAndUpdate(
      { key },
      { key, value, description, isEditable: true },
      { upsert: true, new: true }
    );
    return config;
  }

  async getAllConfigs(): Promise<AdminConfig[]> {
    return this.adminConfigModel.find();
  }

  async getAnalytics(): Promise<any> {
    const totalUsers = await this.usersService.getAllUsers();
    const activeSubscriptions = await this.subscriptionsService.getAllSubscriptions();
    const allPayments = await this.paymentsService.getAllPayments();

    const totalRevenue = allPayments
      .filter(payment => payment.status === 'successful')
      .reduce((sum, payment) => sum + payment.amount, 0);

    const subscriptionStats = {
      weekly: activeSubscriptions.filter(sub => sub.plan === 'weekly').length,
      monthly: activeSubscriptions.filter(sub => sub.plan === 'monthly').length,
      yearly: activeSubscriptions.filter(sub => sub.plan === 'yearly').length,
    };

    return {
      totalUsers: totalUsers.length,
      activeSubscriptions: activeSubscriptions.length,
      totalRevenue,
      subscriptionStats,
      recentPayments: allPayments.slice(0, 10),
    };
  }

  async updatePricing(plan: string, price: number): Promise<void> {
    await this.setConfig(`${plan.toUpperCase()}_PRICE`, price, `${plan} subscription price in kobo`);
  }

  async updateInstructionsLimit(plan: string, limit: number): Promise<void> {
    await this.setConfig(`${plan.toUpperCase()}_INSTRUCTIONS_LIMIT`, limit, `${plan} instructions limit`);
  }

  async updateFreeTrialDays(days: number): Promise<void> {
    await this.setConfig('FREE_TRIAL_DAYS', days, 'Free trial duration in days');
  }

  async updateFreeTrialInstructions(instructions: number): Promise<void> {
    await this.setConfig('FREE_TRIAL_INSTRUCTIONS', instructions, 'Free trial instructions limit');
  }
}
