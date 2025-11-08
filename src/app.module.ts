import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { AuditLoggerService } from './common/services/audit-logger.service';
import { SecurityInterceptor } from './common/interceptors/security.interceptor';
import { AuditLog, AuditLogSchema } from './common/schemas/audit-log.schema';

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
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/snapfit'),
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
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
    AuditLoggerService,
  ],
})
export class AppModule {}
