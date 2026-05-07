import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { AiModule } from './ai/ai.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { MediaModule } from './media/media.module';
import { ProgressModule } from './progress/progress.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { TestModule } from './test/test.module';
import { BodyAnalysisModule } from './body-analysis/body-analysis.module';
import { MediaPipeModule } from './mediapipe/mediapipe.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { ReferralsModule } from './referrals/referrals.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { AuditLoggerService } from './common/services/audit-logger.service';
import { SecurityInterceptor } from './common/interceptors/security.interceptor';
import { AuditLog, AuditLogSchema } from './common/schemas/audit-log.schema';
import { ErrorLogFilter } from './admin/filters/error-log.filter';
import { ErrorLog, ErrorLogSchema } from './common/schemas/error-log.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/gymtedd'),
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: ErrorLog.name, schema: ErrorLogSchema },
    ]),
    TestModule,
    AuthModule,
    UsersModule,
    WorkoutsModule,
    AiModule,
    SubscriptionsModule,
    PaymentsModule,
    MediaModule,
    ProgressModule,
    AdminModule,
    HealthModule,
    BodyAnalysisModule,
    MediaPipeModule,
    NutritionModule,
    AffiliatesModule,
    ReferralsModule,
    WaitlistModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ErrorLogFilter,
    },
    AuditLoggerService,
  ],
})
export class AppModule {}
