import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { Waitlist, WaitlistSchema } from './schemas/waitlist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Waitlist.name, schema: WaitlistSchema }]),
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
