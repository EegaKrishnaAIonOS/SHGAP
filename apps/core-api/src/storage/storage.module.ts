import { Global, Module } from '@nestjs/common';
import { AvScanService } from './av-scan.service';
import { MinioService } from './minio.service';

@Global()
@Module({
  providers: [MinioService, AvScanService],
  exports: [MinioService, AvScanService],
})
export class StorageModule {}
