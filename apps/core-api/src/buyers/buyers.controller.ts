import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BuyersService } from './buyers.service';
import { CreateBuyerDto } from './dto/create-buyer.dto';
import { ImportBuyersDto } from './dto/import-buyers.dto';
import { QueryBuyerDto } from './dto/query-buyer.dto';
import { UpdateBuyerDto } from './dto/update-buyer.dto';

/**
 * Reads are open to any authenticated user (SHGs/officials need to see the
 * buyer registry for matching/dashboards); writes are ADMIN-only — the
 * buyer registry is centrally curated data, not a self-service resource
 * owned by any one SHG (unlike `shgs`/`products`).
 */
@ApiTags('buyers')
@ApiBearerAuth()
@Controller('buyers')
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Register a buyer (admin only)' })
  create(@Body() dto: CreateBuyerDto) {
    return this.buyersService.create(dto);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Bulk-register buyers (admin only) — best-effort, one bad row does not block the rest',
  })
  importMany(@Body() dto: ImportBuyersDto) {
    return this.buyersService.importMany(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List buyers, paginated and filterable by type/district/category',
  })
  findAll(@Query() query: QueryBuyerDto) {
    return this.buyersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single buyer by id' })
  findOne(@Param('id') id: string) {
    return this.buyersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a buyer (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateBuyerDto) {
    return this.buyersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a buyer (admin only)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.buyersService.remove(id);
  }
}
