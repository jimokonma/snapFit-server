import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { FileSecurityService } from '../common/services/file-security.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, FileSecurityService],
  exports: [MediaService],
})
export class MediaModule {}
