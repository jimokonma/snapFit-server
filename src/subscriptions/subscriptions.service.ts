import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument, SubscriptionPlan, SubscriptionStatus } from '../common/schemas/subscription.schema';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async createSubscription(userId: string, plan: SubscriptionPlan, price: number, instructionsLimit: number): Promise<Subscription> {
    const startDate = new Date();
    const endDate = new Date();
    
    // Calculate end date based on plan
    switch (plan) {
      case SubscriptionPlan.WEEKLY:
        endDate.setDate(endDate.getDate() + 7);
        break;
      case SubscriptionPlan.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case SubscriptionPlan.YEARLY:
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    const subscription = new this.subscriptionModel({
      userId: new Types.ObjectId(userId),
      plan,
      price,
      instructionsLimit,
      startDate,
      endDate,
      status: SubscriptionStatus.PENDING,
    });

    return subscription.save();
  }

  async getUserActiveSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    });
  }

  async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus, paystackReference?: string): Promise<Subscription> {
    const updateData: any = { status };
    if (paystackReference) {
      updateData.paystackReference = paystackReference;
    }

    const subscription = await this.subscriptionModel.findByIdAndUpdate(
      subscriptionId,
      updateData,
      { new: true }
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async incrementInstructionsUsed(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findByIdAndUpdate(
      subscriptionId,
      { $inc: { instructionsUsed: 1 } },
      { new: true }
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async getInstructionsRemaining(subscriptionId: string): Promise<number> {
    const subscription = await this.subscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return Math.max(0, subscription.instructionsLimit - subscription.instructionsUsed);
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionModel.find().populate('userId', 'email firstName lastName');
  }

  async cancelSubscription(subscriptionId: string, reason?: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findByIdAndUpdate(
      subscriptionId,
      {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      { new: true }
    );

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }
}
