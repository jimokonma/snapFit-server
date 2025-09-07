import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentType } from '../common/schemas/payment.schema';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create payment' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  async createPayment(
    @Request() req,
    @Body() body: {
      type: PaymentType;
      amount: number;
      currency: string;
      description: string;
      subscriptionId?: string;
    },
  ) {
    return this.paymentsService.createPayment(
      req.user.sub,
      body.type,
      body.amount,
      body.currency,
      body.description,
      body.subscriptionId,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user payment history' })
  @ApiResponse({ status: 200, description: 'Payment history retrieved successfully' })
  async getUserPayments(@Request() req) {
    return this.paymentsService.getUserPayments(req.user.sub);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Paystack webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() body: any) {
    // Handle Paystack webhook
    const { event, data } = body;
    
    if (event === 'charge.success') {
      await this.paymentsService.updatePaymentStatus(
        data.reference,
        'successful' as any,
        data.id,
      );
    } else if (event === 'charge.failed') {
      await this.paymentsService.updatePaymentStatus(
        data.reference,
        'failed' as any,
        data.id,
        data.gateway_response,
      );
    }

    return { status: 'success' };
  }

  // Admin endpoints
  @Get('all')
  @ApiOperation({ summary: 'Get all payments (Admin only)' })
  @ApiResponse({ status: 200, description: 'All payments retrieved successfully' })
  async getAllPayments() {
    return this.paymentsService.getAllPayments();
  }
}
