import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';

@ApiTags('master-data')
@ApiBearerAuth()
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('districts')
  @ApiOperation({ summary: 'List the pilot districts' })
  districts() {
    return this.masterDataService.districts();
  }

  @Get('districts/:id/ulbs')
  @ApiOperation({ summary: 'List ULBs within a district' })
  ulbs(@Param('id') id: string) {
    return this.masterDataService.ulbsByDistrict(id);
  }

  @Get('districts/:id/mandals')
  @ApiOperation({ summary: 'List mandals within a district' })
  mandals(@Param('id') id: string) {
    return this.masterDataService.mandalsByDistrict(id);
  }

  @Get('categories')
  @ApiOperation({
    summary:
      'List the product category taxonomy (2-level, parents with nested children)',
  })
  categories() {
    return this.masterDataService.categories();
  }
}
