import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { SalesTrendQueryDto } from './dto/sales-trend-query.dto';

/**
 * T18 — every endpoint here is officials-only (district/ULB dashboards,
 * Module 5/7) and district/ULB-scoped the same way `/admin/summary` (T09)
 * already is: an official sees only their own district/ULB's numbers,
 * ADMIN/STATE_OFFICIAL see everything.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(ScopeGuard, RolesGuard)
@Roles('ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'ULB_OFFICIAL')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales/districts')
  @ApiOperation({
    summary: 'Sales rolled up by district, filterable by category/date range',
  })
  districtSales(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.districtSales(scope, filters);
  }

  @Get('sales/ulbs')
  @ApiOperation({
    summary:
      'Sales rolled up by ULB, filterable by district/category/date range',
  })
  ulbSales(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.ulbSales(scope, filters);
  }

  @Get('sales/categories')
  @ApiOperation({
    summary:
      'Sales rolled up by product category, filterable by district/ULB/date range',
  })
  categorySales(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.categorySales(scope, filters);
  }

  @Get('sales/trend')
  @ApiOperation({ summary: 'Sales over time, bucketed by day/week/month' })
  salesTrend(
    @CurrentScope() scope: RequestScope,
    @Query() filters: SalesTrendQueryDto,
  ) {
    return this.analyticsService.salesTrend(scope, filters);
  }

  @Get('recommendations/summary')
  @ApiOperation({
    summary: 'Recommendation counts by status and acceptance rate',
  })
  recommendationSummary(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.recommendationSummary(scope, filters);
  }

  @Get('shgs')
  @ApiOperation({
    summary: 'SHGs with sales/product/enquiry rollups, paginated',
  })
  shgs(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.shgs(scope, filters);
  }

  @Get('shgs/:id')
  @ApiOperation({
    summary: 'A single SHG with its full rollup and per-product breakdown',
  })
  shgDetail(@CurrentScope() scope: RequestScope, @Param('id') id: string) {
    return this.analyticsService.shgDetail(id, scope);
  }

  @Get('products')
  @ApiOperation({ summary: 'Products with sales/enquiry rollups, paginated' })
  products(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.products(scope, filters);
  }

  @Get('buyers')
  @ApiOperation({
    summary: 'Buyers with order/enquiry/recommendation rollups, paginated',
  })
  buyers(
    @CurrentScope() scope: RequestScope,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.buyers(scope, filters);
  }

  @Post('refresh-views')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Manually refresh the analytics materialized views (admin only)',
  })
  refreshViews() {
    return this.analyticsService.refreshViews();
  }
}
