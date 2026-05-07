import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdminConfig, AdminConfigDocument } from '../common/schemas/admin-config.schema';
import { ErrorLog, ErrorLogDocument } from '../common/schemas/error-log.schema';
import { AiTokenUsage, AiTokenUsageDocument } from '../common/schemas/ai-token-usage.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Subscription, SubscriptionDocument } from '../common/schemas/subscription.schema';
import { Payment, PaymentDocument } from '../common/schemas/payment.schema';
import { PushNotificationService } from './services/push-notification.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(AdminConfig.name) private adminConfigModel: Model<AdminConfigDocument>,
    @InjectModel(ErrorLog.name) private errorLogModel: Model<ErrorLogDocument>,
    @InjectModel(AiTokenUsage.name) private tokenUsageModel: Model<AiTokenUsageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private pushService: PushNotificationService,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfig(key: string): Promise<any> {
    const config = await this.adminConfigModel.findOne({ key });
    return config ? config.value : null;
  }

  async setConfig(key: string, value: any, description?: string): Promise<AdminConfig> {
    return this.adminConfigModel.findOneAndUpdate(
      { key },
      { key, value, description, isEditable: true },
      { upsert: true, new: true },
    );
  }

  async getAllConfigs(): Promise<AdminConfig[]> {
    return this.adminConfigModel.find();
  }

  async updatePricing(plan: string, price: number): Promise<void> {
    await this.setConfig(`${plan.toUpperCase()}_PRICE`, price, `${plan} subscription price in kobo`);
  }

  async updateQuotaLimit(tier: string, quotaType: string, limit: number): Promise<void> {
    await this.setConfig(`${tier.toUpperCase()}_${quotaType.toUpperCase()}_LIMIT`, limit, `${tier} ${quotaType} limit`);
  }

  async updateInstructionsLimit(plan: string, limit: number): Promise<void> {
    await this.setConfig(`${plan.toUpperCase()}_AI_IMAGES_LIMIT`, limit, `${plan} AI images limit`);
  }

  async updateFreeTrialDays(days: number): Promise<void> {
    await this.setConfig('FREE_TRIAL_DAYS', days, 'Number of free trial days');
  }

  async updateFreeTrialInstructions(instructions: number): Promise<void> {
    await this.setConfig('FREE_TRIAL_INSTRUCTIONS', instructions, 'Free trial instruction generations allowed');
  }

  // ── Dashboard Overview ────────────────────────────────────────────────────

  async getDashboardOverview(): Promise<any> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisMonth,
      activeSubscriptions,
      allPayments,
      errorCount,
      unresolvedErrors,
      tokenStatsToday,
      tokenStatsTotal,
      bannedUsers,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      this.userModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
      this.subscriptionModel.countDocuments({ status: 'active', endDate: { $gt: now } }),
      this.paymentModel.find({ status: 'successful' }),
      this.errorLogModel.countDocuments(),
      this.errorLogModel.countDocuments({ level: 'critical' }),
      this.tokenUsageModel.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
      ]),
      this.tokenUsageModel.aggregate([
        { $group: { _id: null, totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
      ]),
      this.userModel.countDocuments({ isBanned: true }),
    ]);

    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const thisMonthRevenue = allPayments
      .filter((p) => new Date((p as any).createdAt) >= startOfMonth)
      .reduce((sum, p) => sum + p.amount, 0);
    const lastMonthRevenue = allPayments
      .filter((p) => {
        const d = new Date((p as any).createdAt);
        return d >= startOfLastMonth && d <= endOfLastMonth;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const subStats = await this.subscriptionModel.aggregate([
      { $match: { status: 'active', endDate: { $gt: now } } },
      { $group: { _id: '$tier', count: { $sum: 1 } } },
    ]);

    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newThisMonth: newUsersThisMonth,
        banned: bannedUsers,
      },
      subscriptions: {
        active: activeSubscriptions,
        byPlan: subStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      },
      revenue: {
        totalKobo: totalRevenue,
        thisMonthKobo: thisMonthRevenue,
        lastMonthKobo: lastMonthRevenue,
        growthPercent: lastMonthRevenue > 0
          ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : null,
      },
      errors: {
        total: errorCount,
        critical: unresolvedErrors,
      },
      aiTokens: {
        today: tokenStatsToday[0] || { totalTokens: 0, totalCost: 0, count: 0 },
        allTime: tokenStatsTotal[0] || { totalTokens: 0, totalCost: 0, count: 0 },
      },
    };
  }

  // ── User Management ───────────────────────────────────────────────────────

  async getAllUsers(page = 1, limit = 20, search?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -refreshToken -emailVerificationToken -passwordResetToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(query),
    ]);

    // Attach active subscription to each user
    const userIds = users.map((u: any) => u._id);
    const now = new Date();
    const activeSubs = await this.subscriptionModel.find({
      userId: { $in: userIds },
      status: 'active',
      endDate: { $gt: now },
    });
    const subMap = activeSubs.reduce((acc: any, sub: any) => {
      acc[sub.userId.toString()] = sub;
      return acc;
    }, {});

    // Attach token usage totals
    const tokenStats = await this.tokenUsageModel.aggregate([
      { $match: { userId: { $in: userIds.map(String) } } },
      { $group: { _id: '$userId', totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' } } },
    ]);
    const tokenMap = tokenStats.reduce((acc: any, t) => {
      acc[t._id] = t;
      return acc;
    }, {});

    const enriched = users.map((u: any) => ({
      ...u.toObject(),
      activeSubscription: subMap[u._id.toString()] || null,
      tokenUsage: tokenMap[u._id.toString()] || { totalTokens: 0, totalCost: 0 },
    }));

    return {
      users: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getUserDetail(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const [activeSub, allPayments, tokenStats, recentErrors] = await Promise.all([
      this.subscriptionModel.findOne({ userId: new Types.ObjectId(userId), status: 'active', endDate: { $gt: now } }),
      this.paymentModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(10),
      this.tokenUsageModel.aggregate([
        { $match: { userId } },
        { $group: { _id: '$operation', totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
        { $sort: { totalTokens: -1 } },
      ]),
      this.errorLogModel.find({ userId }).sort({ createdAt: -1 }).limit(5),
    ]);

    return {
      ...user.toObject(),
      activeSubscription: activeSub,
      recentPayments: allPayments,
      tokenUsageByOperation: tokenStats,
      recentErrors,
    };
  }

  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && (user as any).email === adminEmail && role !== 'admin') {
      throw new BadRequestException('Cannot demote the primary admin');
    }
    const updated = await this.userModel.findByIdAndUpdate(userId, { role }, { new: true });
    return updated;
  }

  async banUser(userId: string, reason?: string): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isBanned: true, banReason: reason || 'Banned by admin', isActive: false },
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async unbanUser(userId: string): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isBanned: false, banReason: null, isActive: true },
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(userId);
    if (!result) throw new NotFoundException('User not found');
    // Clean up associated data
    await Promise.all([
      this.subscriptionModel.deleteMany({ userId: new Types.ObjectId(userId) }),
      this.paymentModel.deleteMany({ userId: new Types.ObjectId(userId) }),
      this.tokenUsageModel.deleteMany({ userId }),
    ]);
  }

  async grantPremium(userId: string, tier: 'pro' | 'elite', days?: number): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const durationDays = days ?? (tier === 'elite' ? 365 : 30);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);

    await this.subscriptionModel.updateMany(
      { userId: new Types.ObjectId(userId), status: 'active' },
      { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Superseded by admin grant' },
    );

    const sub = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      tier,
      status: 'active',
      price: 0,
      startDate,
      endDate,
      quotaResetDate: resetDate,
      isGrandfathered: true,
      grantedByAdmin: true,
      paymentProvider: 'none',
    });

    await this.userModel.findByIdAndUpdate(userId, { tier });
    return sub;
  }

  async savePushToken(userId: string, token: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { pushToken: token });
  }

  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    const user = await this.userModel.findById(userId).select('pushToken email');
    if (!user) throw new NotFoundException('User not found');
    if (!(user as any).pushToken) throw new BadRequestException('User has no registered push token');
    return this.pushService.sendToToken((user as any).pushToken, title, body, data);
  }

  async broadcastPushNotification(title: string, body: string, data?: Record<string, any>): Promise<number> {
    const users = await this.userModel.find({ pushToken: { $exists: true, $ne: null } }).select('pushToken');
    const tokens = users.map((u: any) => u.pushToken).filter(Boolean);
    return this.pushService.sendToTokens(tokens, title, body, data);
  }

  // ── AI Token Analytics ────────────────────────────────────────────────────

  async getTokenStats(days = 30): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalStats, byOperation, byUser, dailyBreakdown] = await Promise.all([
      this.tokenUsageModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: null, totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, callCount: { $sum: 1 }, inputTokens: { $sum: '$inputTokens' }, outputTokens: { $sum: '$outputTokens' } } },
      ]),
      this.tokenUsageModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$operation', totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
        { $sort: { totalTokens: -1 } },
      ]),
      this.tokenUsageModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$userId', totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, callCount: { $sum: 1 } } },
        { $sort: { totalTokens: -1 } },
        { $limit: 20 },
      ]),
      this.tokenUsageModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Enrich top users with email
    const userIds = byUser.map((u) => u._id);
    const users = await this.userModel.find({ _id: { $in: userIds } }).select('email firstName lastName');
    const userMap = users.reduce((acc: any, u: any) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});

    const enrichedByUser = byUser.map((u) => ({
      ...u,
      user: userMap[u._id] || { email: 'Unknown', firstName: '', lastName: '' },
    }));

    return {
      summary: totalStats[0] || { totalTokens: 0, totalCost: 0, callCount: 0, inputTokens: 0, outputTokens: 0 },
      byOperation,
      topUsers: enrichedByUser,
      dailyBreakdown,
      periodDays: days,
    };
  }

  async getUserTokenDetail(userId: string, days = 30): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [summary, byOperation, recent] = await Promise.all([
      this.tokenUsageModel.aggregate([
        { $match: { userId, createdAt: { $gte: since } } },
        { $group: { _id: null, totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, callCount: { $sum: 1 } } },
      ]),
      this.tokenUsageModel.aggregate([
        { $match: { userId, createdAt: { $gte: since } } },
        { $group: { _id: '$operation', totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$estimatedCostUsd' }, count: { $sum: 1 } } },
        { $sort: { totalTokens: -1 } },
      ]),
      this.tokenUsageModel.find({ userId }).sort({ createdAt: -1 }).limit(50),
    ]);

    return {
      summary: summary[0] || { totalTokens: 0, totalCost: 0, callCount: 0 },
      byOperation,
      recent,
    };
  }

  // ── Error Logs ────────────────────────────────────────────────────────────

  async getErrorLogs(page = 1, limit = 50, level?: string, endpoint?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (level) query.level = level;
    if (endpoint) query.endpoint = { $regex: endpoint, $options: 'i' };

    const [errors, total] = await Promise.all([
      this.errorLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.errorLogModel.countDocuments(query),
    ]);

    const stats = await this.errorLogModel.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);

    return {
      errors,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: stats.reduce((acc: any, s) => ({ ...acc, [s._id]: s.count }), {}),
    };
  }

  async clearAllErrors(): Promise<void> {
    await this.errorLogModel.deleteMany({});
  }

  async clearError(errorId: string): Promise<void> {
    const result = await this.errorLogModel.findByIdAndDelete(errorId);
    if (!result) throw new NotFoundException('Error log not found');
  }

  // ── Revenue & Subscriptions ───────────────────────────────────────────────

  async getRevenueMetrics(days = 90): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const now = new Date();

    const [allPayments, subscriptionsByPlan, churnedThisMonth, recentPayments] = await Promise.all([
      this.paymentModel.find({ status: 'successful', createdAt: { $gte: since } }).populate('userId', 'email firstName lastName'),
      this.subscriptionModel.aggregate([
        { $match: { status: 'active', endDate: { $gt: now } } },
        { $group: { _id: '$plan', count: { $sum: 1 }, totalRevenue: { $sum: '$price' } } },
      ]),
      this.subscriptionModel.countDocuments({
        status: 'cancelled',
        cancelledAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      }),
      this.paymentModel.find({ status: 'successful' }).sort({ createdAt: -1 }).limit(20).populate('userId', 'email firstName lastName'),
    ]);

    // Daily revenue breakdown
    const dailyRevenue = await this.paymentModel.aggregate([
      { $match: { status: 'successful', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalKobo: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const activeSubCount = subscriptionsByPlan.reduce((sum, s) => sum + s.count, 0);

    // MRR estimate: sum of monthly-equivalent revenue from active subs
    const planMonthlyRate: Record<string, number> = {};
    await Promise.all(
      ['weekly', 'monthly', 'yearly'].map(async (plan) => {
        const price = await this.getConfig(`${plan.toUpperCase()}_PRICE`);
        if (price) {
          planMonthlyRate[plan] = plan === 'weekly' ? price * 4.33 : plan === 'yearly' ? price / 12 : price;
        }
      }),
    );

    const mrrKobo = subscriptionsByPlan.reduce((sum, s) => {
      return sum + s.count * (planMonthlyRate[s._id] || 0);
    }, 0);

    return {
      totalRevenueKobo: totalRevenue,
      mrrKobo,
      arrKobo: mrrKobo * 12,
      activeSubscriptions: activeSubCount,
      churnedThisMonth,
      byPlan: subscriptionsByPlan,
      dailyRevenue,
      recentPayments,
      periodDays: days,
    };
  }

  async getAllSubscriptions(page = 1, limit = 20, status?: string): Promise<any> {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (status) query.status = status;

    const [subs, total] = await Promise.all([
      this.subscriptionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'email firstName lastName'),
      this.subscriptionModel.countDocuments(query),
    ]);

    return {
      subscriptions: subs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async modifySubscription(subId: string, updates: { status?: string; endDate?: Date; tier?: string }): Promise<any> {
    const sub = await this.subscriptionModel.findByIdAndUpdate(subId, updates, { new: true });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (updates.tier) {
      await this.userModel.findByIdAndUpdate(sub.userId, { tier: updates.tier });
    }
    return sub;
  }

  // ── Legacy analytics (kept for backward compat) ───────────────────────────

  async getAnalytics(): Promise<any> {
    return this.getDashboardOverview();
  }
}
