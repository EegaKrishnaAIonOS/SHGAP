import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audited } from '../../audit/audited.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GemOpportunitiesService } from './gem-opportunities.service';
import { CreateGemOpportunityDto } from './dto/create-gem-opportunity.dto';
import { ImportGemOpportunitiesDto } from './dto/import-gem-opportunities.dto';
import { QueryGemOpportunityDto } from './dto/query-gem-opportunity.dto';

/** GeM procurement opportunities (T16/ADR-0025) — reads open to any
 * authenticated user, same reasoning as the buyer registry; writes are
 * ADMIN-only, real as of T21 (ADR-0030) though most rows today are still
 * seeded/simulated (`isSimulated: true`). */
@ApiTags('gem-opportunities')
@ApiBearerAuth()
@Controller('gem-opportunities')
export class GemOpportunitiesController {
  constructor(
    private readonly gemOpportunitiesService: GemOpportunitiesService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Audited('GemOpportunity')
  @ApiOperation({
    summary:
      'Record a GeM procurement opportunity (admin only) — triggers a tender-opportunity alert to every SHG with a matching-category product',
  })
  create(@Body() dto: CreateGemOpportunityDto) {
    return this.gemOpportunitiesService.create(dto);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Bulk-record GeM opportunities (admin only) — best-effort, one bad row does not block the rest',
  })
  importMany(@Body() dto: ImportGemOpportunitiesDto) {
    return this.gemOpportunitiesService.importMany(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List GeM procurement opportunities, paginated and filterable',
  })
  findAll(@Query() query: QueryGemOpportunityDto) {
    return this.gemOpportunitiesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single GeM procurement opportunity by id' })
  findOne(@Param('id') id: string) {
    return this.gemOpportunitiesService.findOne(id);
  }
}
