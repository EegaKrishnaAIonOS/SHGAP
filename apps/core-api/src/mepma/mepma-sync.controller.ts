import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MepmaSyncService } from './mepma-sync.service';

@ApiTags('mepma')
@Controller('mepma')
export class MepmaSyncController {
  constructor(private readonly mepmaSyncService: MepmaSyncService) {}

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Manually trigger a MEPMA SHG registry sync — same job the scheduled interval runs automatically',
  })
  sync() {
    return this.mepmaSyncService.syncShgRegistry();
  }
}
