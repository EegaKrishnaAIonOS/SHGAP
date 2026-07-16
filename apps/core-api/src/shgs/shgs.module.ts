import { Module } from '@nestjs/common';
import { ShgsController } from './shgs.controller';
import { ShgsService } from './shgs.service';

@Module({
  controllers: [ShgsController],
  providers: [ShgsService],
  exports: [ShgsService],
})
export class ShgsModule {}
