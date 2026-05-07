import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionTier, BillingCycle, TIER_PRICING_USD } from '../common/schemas/subscription.schema';

export interface PayProCheckoutResult {
  checkoutUrl: string;
  orderId: string;
}

export interface PayProWebhookPayload {
  event: string;
  order_id: string;
  reference: string;
  status: 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  customer_email: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class PayProService {
  private readonly logger = new Logger(PayProService.name);

  // ── TODO: Fill in after PayPro Global registration ────────────────────
  // 1. Sign up at https://payproglobal.com
  // 2. Create a product for each tier+cycle combination
  // 3. Copy your Merchant ID, API key, and Webhook secret into .env:
  //    PAYPRO_MERCHANT_ID=
  //    PAYPRO_API_KEY=
  //    PAYPRO_WEBHOOK_SECRET=
  //    PAYPRO_BASE_URL=https://store.payproglobal.com  (or sandbox URL for testing)
  // ─────────────────────────────────────────────────────────────────────

  private readonly merchantId: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get('PAYPRO_MERCHANT_ID') ?? 'PLACEHOLDER_MERCHANT_ID';
    this.apiKey = this.configService.get('PAYPRO_API_KEY') ?? 'PLACEHOLDER_API_KEY';
    this.webhookSecret = this.configService.get('PAYPRO_WEBHOOK_SECRET') ?? 'PLACEHOLDER_WEBHOOK_SECRET';
    this.baseUrl = this.configService.get('PAYPRO_BASE_URL') ?? 'https://store.payproglobal.com';
  }

  /**
   * Creates a PayPro Global checkout session and returns the redirect URL.
   * Called from the web (landing page) or via mobile webview.
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    tier: SubscriptionTier.PRO | SubscriptionTier.ELITE,
    billingCycle: BillingCycle,
    currency: string = 'USD',
  ): Promise<PayProCheckoutResult> {
    const amountCents = TIER_PRICING_USD[tier][billingCycle];
    const productId = this.getProductId(tier, billingCycle);
    const reference = `Gymtedd_${userId}_${Date.now()}`;

    const params = new URLSearchParams({
      merchant_id: this.merchantId,
      product_id: productId,
      customer_email: userEmail,
      x_userId: userId,
      x_tier: tier,
      x_billingCycle: billingCycle,
      x_reference: reference,
      billing_cycle: billingCycle === BillingCycle.YEARLY ? 'annual' : 'monthly',
      currency,
    });

    const checkoutUrl = `${this.baseUrl}/checkout?${params.toString()}`;

    this.logger.log(`PayPro checkout created for user ${userId}: ${tier}/${billingCycle}`);

    return { checkoutUrl, orderId: reference };
  }

  /**
   * Verifies the webhook signature from PayPro Global.
   * PayPro sends an HMAC-SHA256 signature in the X-PayPro-Signature header.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (this.webhookSecret === 'PLACEHOLDER_WEBHOOK_SECRET') {
      this.logger.error('PayPro webhook secret not configured — rejecting webhook');
      return false;
    }

    try {
      const crypto = require('crypto');
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');
      if (expectedBuf.length !== signatureBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  /**
   * Extracts structured data from a verified PayPro webhook body.
   */
  parseWebhookPayload(body: any): PayProWebhookPayload {
    return {
      event: body.event ?? body.notification_type,
      order_id: body.order_id ?? body.id,
      reference: body.x_reference ?? body.custom_reference,
      status: this.normaliseStatus(body.status ?? body.order_status),
      amount: Number(body.amount ?? body.order_total ?? 0),
      currency: body.currency ?? 'USD',
      customer_email: body.customer_email ?? body.email,
      metadata: {
        userId: body.x_userId,
        tier: body.x_tier,
        billingCycle: body.x_billingCycle,
      },
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private getProductId(
    tier: SubscriptionTier.PRO | SubscriptionTier.ELITE,
    billingCycle: BillingCycle,
  ): string {
    // TODO: Replace with actual product IDs from your PayPro Global dashboard
    const ids: Record<string, string> = {
      [`${SubscriptionTier.PRO}_${BillingCycle.MONTHLY}`]: 'PLACEHOLDER_PRO_MONTHLY_ID',
      [`${SubscriptionTier.PRO}_${BillingCycle.YEARLY}`]: 'PLACEHOLDER_PRO_YEARLY_ID',
      [`${SubscriptionTier.ELITE}_${BillingCycle.MONTHLY}`]: 'PLACEHOLDER_ELITE_MONTHLY_ID',
      [`${SubscriptionTier.ELITE}_${BillingCycle.YEARLY}`]: 'PLACEHOLDER_ELITE_YEARLY_ID',
    };
    return ids[`${tier}_${billingCycle}`];
  }

  private normaliseStatus(raw: string): 'completed' | 'failed' | 'refunded' {
    const s = (raw ?? '').toLowerCase();
    if (s.includes('complet') || s.includes('success') || s.includes('paid')) return 'completed';
    if (s.includes('refund')) return 'refunded';
    return 'failed';
  }
}
