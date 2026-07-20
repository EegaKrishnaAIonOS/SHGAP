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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateDistrictDto } from './dto/create-district.dto';
import { CreateFestivalCalendarDto } from './dto/create-festival-calendar.dto';
import { CreateMandalDto } from './dto/create-mandal.dto';
import { CreateUlbDto } from './dto/create-ulb.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { UpdateFestivalCalendarDto } from './dto/update-festival-calendar.dto';
import { UpdateMandalDto } from './dto/update-mandal.dto';
import { UpdateUlbDto } from './dto/update-ulb.dto';
import { MasterDataService } from './master-data.service';

/**
 * Reads are open to any authenticated user (the SHG registration/product
 * forms depend on these for their dropdowns); writes are ADMIN-only (T09) —
 * master data is platform-wide configuration, not something a district/ULB
 * official or SHG member should be able to change.
 */
@ApiTags('master-data')
@ApiBearerAuth()
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  // ---------------------------------------------------------------------
  // Districts
  // ---------------------------------------------------------------------

  @Get('districts')
  @ApiOperation({ summary: 'List the pilot districts' })
  districts() {
    return this.masterDataService.districts();
  }

  @Post('districts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a district (admin only)' })
  createDistrict(@Body() dto: CreateDistrictDto) {
    return this.masterDataService.createDistrict(dto);
  }

  @Patch('districts/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a district (admin only)' })
  updateDistrict(@Param('id') id: string, @Body() dto: UpdateDistrictDto) {
    return this.masterDataService.updateDistrict(id, dto);
  }

  @Delete('districts/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a district (admin only)' })
  async removeDistrict(@Param('id') id: string): Promise<void> {
    await this.masterDataService.removeDistrict(id);
  }

  // ---------------------------------------------------------------------
  // ULBs
  // ---------------------------------------------------------------------

  @Get('districts/:id/ulbs')
  @ApiOperation({ summary: 'List ULBs within a district' })
  ulbsByDistrict(@Param('id') id: string) {
    return this.masterDataService.ulbsByDistrict(id);
  }

  @Get('ulbs')
  @ApiOperation({ summary: 'List all ULBs across every district' })
  ulbs() {
    return this.masterDataService.ulbs();
  }

  @Post('ulbs')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a ULB (admin only)' })
  createUlb(@Body() dto: CreateUlbDto) {
    return this.masterDataService.createUlb(dto);
  }

  @Patch('ulbs/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a ULB (admin only)' })
  updateUlb(@Param('id') id: string, @Body() dto: UpdateUlbDto) {
    return this.masterDataService.updateUlb(id, dto);
  }

  @Delete('ulbs/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ULB (admin only)' })
  async removeUlb(@Param('id') id: string): Promise<void> {
    await this.masterDataService.removeUlb(id);
  }

  // ---------------------------------------------------------------------
  // Mandals
  // ---------------------------------------------------------------------

  @Get('districts/:id/mandals')
  @ApiOperation({ summary: 'List mandals within a district' })
  mandalsByDistrict(@Param('id') id: string) {
    return this.masterDataService.mandalsByDistrict(id);
  }

  @Get('mandals')
  @ApiOperation({ summary: 'List all mandals across every district' })
  mandals() {
    return this.masterDataService.mandals();
  }

  @Post('mandals')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a mandal (admin only)' })
  createMandal(@Body() dto: CreateMandalDto) {
    return this.masterDataService.createMandal(dto);
  }

  @Patch('mandals/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a mandal (admin only)' })
  updateMandal(@Param('id') id: string, @Body() dto: UpdateMandalDto) {
    return this.masterDataService.updateMandal(id, dto);
  }

  @Delete('mandals/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a mandal (admin only)' })
  async removeMandal(@Param('id') id: string): Promise<void> {
    await this.masterDataService.removeMandal(id);
  }

  // ---------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------

  @Get('categories')
  @ApiOperation({
    summary:
      'List the product category taxonomy (2-level, parents with nested children)',
  })
  categories() {
    return this.masterDataService.categories();
  }

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a category (admin only)' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.masterDataService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a category (admin only)' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.masterDataService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category (admin only)' })
  async removeCategory(@Param('id') id: string): Promise<void> {
    await this.masterDataService.removeCategory(id);
  }

  // ---------------------------------------------------------------------
  // Festival calendar
  // ---------------------------------------------------------------------

  @Get('festival-calendar')
  @ApiOperation({ summary: 'List festival/demand-season calendar entries' })
  festivalCalendar() {
    return this.masterDataService.festivalCalendar();
  }

  @Post('festival-calendar')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a festival calendar entry (admin only)' })
  createFestivalCalendarEntry(@Body() dto: CreateFestivalCalendarDto) {
    return this.masterDataService.createFestivalCalendarEntry(dto);
  }

  @Patch('festival-calendar/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a festival calendar entry (admin only)' })
  updateFestivalCalendarEntry(
    @Param('id') id: string,
    @Body() dto: UpdateFestivalCalendarDto,
  ) {
    return this.masterDataService.updateFestivalCalendarEntry(id, dto);
  }

  @Delete('festival-calendar/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a festival calendar entry (admin only)' })
  async removeFestivalCalendarEntry(@Param('id') id: string): Promise<void> {
    await this.masterDataService.removeFestivalCalendarEntry(id);
  }
}
