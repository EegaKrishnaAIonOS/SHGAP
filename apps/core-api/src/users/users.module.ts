import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { DataRightsService } from './data-rights/data-rights.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ConsentModule],
  controllers: [UsersController],
  providers: [UsersService, DataRightsService],
  exports: [UsersService],
})
export class UsersModule {}
