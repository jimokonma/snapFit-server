import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PayProService } from './paypro.service';
import { Payment, PaymentSchema } from '../common/schemas/payment.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    SubscriptionsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayProService],
  exports: [PaymentsService, PayProService],
})
export class PaymentsModule {}
