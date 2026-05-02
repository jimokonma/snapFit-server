import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminConfig, AdminConfigSchema } from '../common/schemas/admin-config.schema';
import { ErrorLog, ErrorLogSchema } from '../common/schemas/error-log.schema';
import { AiTokenUsage, AiTokenUsageSchema } from '../common/schemas/ai-token-usage.schema';
import { User, UserSchema } from '../common/schemas/user.schema';
import { Subscription, SubscriptionSchema } from '../common/schemas/subscription.schema';
import { Payment, PaymentSchema } from '../common/schemas/payment.schema';
import { PushNotificationService } from './services/push-notification.service';
import { ErrorLogFilter } from './filters/error-log.filter';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminConfig.name, schema: AdminConfigSchema },
      { name: ErrorLog.name, schema: ErrorLogSchema },
      { name: AiTokenUsage.name, schema: AiTokenUsageSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    AffiliatesModule,
    ReferralsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, PushNotificationService, ErrorLogFilter],
  exports: [AdminService, PushNotificationService, ErrorLogFilter],
})
export class AdminModule {}
