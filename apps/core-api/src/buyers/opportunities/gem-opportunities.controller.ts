import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GemOpportunitiesService } from './gem-opportunities.service';
import { QueryGemOpportunityDto } from './dto/query-gem-opportunity.dto';

/** Simulated GeM procurement opportunities (T16/ADR-0025) — read-only; real
 * GeM API ingestion is T21's "integration readiness" scope. */
@ApiTags('gem-opportunities')
@ApiBearerAuth()
@Controller('gem-opportunities')
export class GemOpportunitiesController {
  constructor(
    private readonly gemOpportunitiesService: GemOpportunitiesService,
  ) {}

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
