import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentType, PaymentStatus, PaymentProvider } from '../common/schemas/payment.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PayProService } from './paypro.service';
import { SubscriptionTier, BillingCycle } from '../common/schemas/subscription.schema';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private subscriptionsService: SubscriptionsService,
    private payProService: PayProService,
  ) {}

  // ── Checkout Initialisation ───────────────────────────────────────────

  /**
   * Determines the correct payment provider based on currency and returns a
   * checkout URL. NGN → Paystack. Everything else → PayPro Global.
   */
  async initiateCheckout(
    userId: string,
    userEmail: string,
    tier: SubscriptionTier.PRO | SubscriptionTier.ELITE,
    billingCycle: BillingCycle,
    currency: string = 'NGN',
  ): Promise<{ checkoutUrl: string; provider: PaymentProvider; reference: string }> {
    if (currency === 'NGN') {
      // Paystack flow — generate reference, app handles redirect
      const reference = this.generateReference('ps');
      await this.paymentModel.create({
        userId: new Types.ObjectId(userId),
        type: PaymentType.SUBSCRIPTION,
        status: PaymentStatus.PENDING,
        amount: 0,
        currency: 'NGN',
        provider: PaymentProvider.PAYSTACK,
        paystackReference: reference,
        description: `SnapFit ${tier} ${billingCycle}`,
        metadata: { tier, billingCycle },
      });
      return { checkoutUrl: '', provider: PaymentProvider.PAYSTACK, reference };
    }

    // International — PayPro Global
    const { checkoutUrl, orderId } = await this.payProService.createCheckoutSession(
      userId,
      userEmail,
      tier,
      billingCycle,
      currency,
    );

    await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      type: PaymentType.SUBSCRIPTION,
      status: PaymentStatus.PENDING,
      amount: 0,
      currency,
      provider: PaymentProvider.PAYPRO_GLOBAL,
      payproReference: orderId,
      description: `SnapFit ${tier} ${billingCycle}`,
      metadata: { tier, billingCycle },
    });

    return { checkoutUrl, provider: PaymentProvider.PAYPRO_GLOBAL, reference: orderId };
  }

  // ── Paystack Webhook ──────────────────────────────────────────────────

  async handlePaystackWebhook(event: string, data: any): Promise<void> {
    if (event === 'charge.success') {
      const payment = await this.paymentModel.findOneAndUpdate(
        { paystackReference: data.reference, provider: PaymentProvider.PAYSTACK },
        { status: PaymentStatus.SUCCESSFUL, paystackTransactionId: String(data.id), paidAt: new Date() },
        { new: true },
      );

      if (payment) {
        const { tier, billingCycle } = payment.metadata as any;
        await this.activateSubscriptionFromPayment(
          payment.userId.toString(),
          tier,
          billingCycle,
          PaymentProvider.PAYSTACK,
          data.reference,
          payment,
        );
      }
    } else if (event === 'charge.failed') {
      await this.paymentModel.findOneAndUpdate(
        { paystackReference: data.reference },
        { status: PaymentStatus.FAILED, failureReason: data.gateway_response },
      );
    }
  }

  // ── PayPro Global Webhook ─────────────────────────────────────────────

  async handlePayProWebhook(rawBody: string, signature: string, body: any): Promise<void> {
    const valid = this.payProService.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('PayPro webhook signature invalid — ignoring');
      return;
    }

    const parsed = this.payProService.parseWebhookPayload(body);

    if (parsed.status === 'completed') {
      const payment = await this.paymentModel.findOneAndUpdate(
        { payproReference: parsed.reference, provider: PaymentProvider.PAYPRO_GLOBAL },
        { status: PaymentStatus.SUCCESSFUL, payproOrderId: parsed.order_id, paidAt: new Date() },
        { new: true },
      );

      if (payment && parsed.metadata?.userId) {
        const { tier, billingCycle } = parsed.metadata;
        await this.activateSubscriptionFromPayment(
          parsed.metadata.userId,
          tier as SubscriptionTier,
          billingCycle as BillingCycle,
          PaymentProvider.PAYPRO_GLOBAL,
          parsed.reference,
          payment,
        );
      }
    } else if (parsed.status === 'failed') {
      await this.paymentModel.findOneAndUpdate(
        { payproReference: parsed.reference },
        { status: PaymentStatus.FAILED },
      );
    }
  }

  private async activateSubscriptionFromPayment(
    userId: string,
    tier: SubscriptionTier,
    billingCycle: BillingCycle,
    provider: 'paystack' | 'paypro_global',
    reference: string,
    payment: PaymentDocument,
  ): Promise<void> {
    try {
      const sub = await this.subscriptionsService.createPaidSubscription(
        userId,
        tier as SubscriptionTier.PRO | SubscriptionTier.ELITE,
        billingCycle,
        provider,
        reference,
      );
      await this.paymentModel.findByIdAndUpdate(payment._id, {
        subscriptionId: (sub as any)._id,
      });
    } catch (err) {
      this.logger.error(`Failed to activate subscription for user ${userId}`, err);
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────

  async getUserPayments(userId: string): Promise<Payment[]> {
    return this.paymentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
  }

  async getAllPayments(): Promise<Payment[]> {
    return this.paymentModel
      .find()
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private generateReference(prefix: string): string {
    return `snapfit_${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
