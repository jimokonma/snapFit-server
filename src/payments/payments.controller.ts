import { Controller, Get, Post, Body, Headers, Param, RawBodyRequest, Req, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PayProService } from './paypro.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { SubscriptionTier, BillingCycle } from '../common/schemas/subscription.schema';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly payProService: PayProService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate checkout — returns checkoutUrl for PayPro or reference for Paystack' })
  async initiateCheckout(
    @Request() req,
    @Body() body: {
      tier: SubscriptionTier.PRO | SubscriptionTier.ELITE;
      billingCycle: BillingCycle;
      currency?: string;
    },
  ) {
    return this.paymentsService.initiateCheckout(
      req.user.sub,
      req.user.email,
      body.tier,
      body.billingCycle,
      body.currency ?? 'NGN',
    );
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user payment history' })
  async getUserPayments(@Request() req) {
    return this.paymentsService.getUserPayments(req.user.sub);
  }

  @Get('verify/paystack/:reference')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a Paystack payment by reference and activate subscription' })
  async verifyPaystack(@Param('reference') reference: string) {
    return this.paymentsService.verifyPaystackPayment(reference);
  }

  // ── Webhooks (no auth — verified by signature) ────────────────────────

  @Post('webhook/paystack')
  @ApiOperation({ summary: 'Paystack webhook handler' })
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing Paystack signature');
    }
    const rawBody = (req as any).rawBody?.toString() ?? JSON.stringify(body);
    if (!this.paymentsService.verifyPaystackSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }
    const { event, data } = body;
    await this.paymentsService.handlePaystackWebhook(event, data);
    return { status: 'ok' };
  }

  @Post('webhook/paypro')
  @ApiOperation({ summary: 'PayPro Global webhook handler' })
  async handlePayProWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paypro-signature') signature: string,
    @Body() body: any,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing PayPro signature');
    }
    const rawBody = (req as any).rawBody?.toString() ?? JSON.stringify(body);
    await this.paymentsService.handlePayProWebhook(rawBody, signature, body);
    return { status: 'ok' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments (Admin only)' })
  async getAllPayments() {
    return this.paymentsService.getAllPayments();
  }
}
