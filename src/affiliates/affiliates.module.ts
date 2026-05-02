import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AffiliatesService } from './affiliates.service';
import { AffiliatesController } from './affiliates.controller';
import { Affiliate, AffiliateSchema } from '../common/schemas/affiliate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Affiliate.name, schema: AffiliateSchema }]),
  ],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
