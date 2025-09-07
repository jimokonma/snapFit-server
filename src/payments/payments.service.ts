import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentType, PaymentStatus } from '../common/schemas/payment.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async createPayment(
    userId: string,
    type: PaymentType,
    amount: number,
    currency: string,
    description: string,
    subscriptionId?: string,
  ): Promise<Payment> {
    const payment = new this.paymentModel({
      userId: new Types.ObjectId(userId),
      subscriptionId: subscriptionId ? new Types.ObjectId(subscriptionId) : undefined,
      type,
      amount,
      currency,
      description,
      paystackReference: this.generatePaystackReference(),
    });

    return payment.save();
  }

  async updatePaymentStatus(
    paystackReference: string,
    status: PaymentStatus,
    paystackTransactionId?: string,
    failureReason?: string,
  ): Promise<Payment> {
    const updateData: any = { status };
    
    if (paystackTransactionId) {
      updateData.paystackTransactionId = paystackTransactionId;
    }
    
    if (failureReason) {
      updateData.failureReason = failureReason;
    }
    
    if (status === PaymentStatus.SUCCESSFUL) {
      updateData.paidAt = new Date();
    }

    const payment = await this.paymentModel.findOneAndUpdate(
      { paystackReference },
      updateData,
      { new: true }
    );

    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment;
  }

  async getUserPayments(userId: string): Promise<Payment[]> {
    return this.paymentModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async getAllPayments(): Promise<Payment[]> {
    return this.paymentModel.find().populate('userId', 'email firstName lastName').sort({ createdAt: -1 });
  }

  private generatePaystackReference(): string {
    return `snapfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
