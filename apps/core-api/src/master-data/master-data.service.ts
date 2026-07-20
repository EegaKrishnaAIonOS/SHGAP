import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
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

const categoryWithChildren = Prisma.validator<Prisma.CategoryDefaultArgs>()({
  include: { children: { orderBy: { name: 'asc' } } },
});

/**
 * Deleting master data that's still referenced elsewhere (a district with
 * ULBs, a category with products, ...) fails at the DB level — every
 * master-data FK uses `onDelete: Restrict` on purpose, since silently
 * cascading would delete real SHG/product/user data. Surfaced as a clean
 * 409 instead of a raw 500, so the admin portal can show "still in use"
 * rather than an opaque server error.
 */
async function runDelete(
  operation: () => Promise<unknown>,
  whatFailed: string,
): Promise<void> {
  try {
    await operation();
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      throw new ConflictException(
        `${whatFailed} is still referenced by other records and can't be deleted`,
      );
    }
    throw err;
  }
}

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Districts
  // ---------------------------------------------------------------------

  districts() {
    return this.prisma.district.findMany({ orderBy: { name: 'asc' } });
  }

  async createDistrict(dto: CreateDistrictDto) {
    return this.prisma.district.create({ data: dto });
  }

  async updateDistrict(id: string, dto: UpdateDistrictDto) {
    await this.requireDistrict(id);
    return this.prisma.district.update({ where: { id }, data: dto });
  }

  async removeDistrict(id: string): Promise<void> {
    await this.requireDistrict(id);
    await runDelete(
      () => this.prisma.district.delete({ where: { id } }),
      'This district',
    );
  }

  private async requireDistrict(id: string) {
    const district = await this.prisma.district.findUnique({ where: { id } });
    if (!district) throw new NotFoundException(`District ${id} not found`);
    return district;
  }

  // ---------------------------------------------------------------------
  // ULBs
  // ---------------------------------------------------------------------

  ulbsByDistrict(districtId: string) {
    return this.prisma.ulb.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
    });
  }

  ulbs() {
    return this.prisma.ulb.findMany({
      include: { district: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createUlb(dto: CreateUlbDto) {
    return this.prisma.ulb.create({ data: dto });
  }

  async updateUlb(id: string, dto: UpdateUlbDto) {
    await this.requireUlb(id);
    return this.prisma.ulb.update({ where: { id }, data: dto });
  }

  async removeUlb(id: string): Promise<void> {
    await this.requireUlb(id);
    await runDelete(
      () => this.prisma.ulb.delete({ where: { id } }),
      'This ULB',
    );
  }

  private async requireUlb(id: string) {
    const ulb = await this.prisma.ulb.findUnique({ where: { id } });
    if (!ulb) throw new NotFoundException(`ULB ${id} not found`);
    return ulb;
  }

  // ---------------------------------------------------------------------
  // Mandals
  // ---------------------------------------------------------------------

  mandalsByDistrict(districtId: string) {
    return this.prisma.mandal.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
    });
  }

  mandals() {
    return this.prisma.mandal.findMany({
      include: { district: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createMandal(dto: CreateMandalDto) {
    return this.prisma.mandal.create({ data: dto });
  }

  async updateMandal(id: string, dto: UpdateMandalDto) {
    await this.requireMandal(id);
    return this.prisma.mandal.update({ where: { id }, data: dto });
  }

  async removeMandal(id: string): Promise<void> {
    await this.requireMandal(id);
    await runDelete(
      () => this.prisma.mandal.delete({ where: { id } }),
      'This mandal',
    );
  }

  private async requireMandal(id: string) {
    const mandal = await this.prisma.mandal.findUnique({ where: { id } });
    if (!mandal) throw new NotFoundException(`Mandal ${id} not found`);
    return mandal;
  }

  // ---------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------

  /** Top-level categories with their children nested (a 2-level taxonomy — see T02 seed). */
  categories() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: categoryWithChildren.include,
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async removeCategory(id: string): Promise<void> {
    await this.requireCategory(id);
    await runDelete(
      () => this.prisma.category.delete({ where: { id } }),
      'This category',
    );
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  // ---------------------------------------------------------------------
  // Festival calendar
  // ---------------------------------------------------------------------

  festivalCalendar() {
    return this.prisma.festivalCalendar.findMany({
      include: { district: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    });
  }

  async createFestivalCalendarEntry(dto: CreateFestivalCalendarDto) {
    return this.prisma.festivalCalendar.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async updateFestivalCalendarEntry(
    id: string,
    dto: UpdateFestivalCalendarDto,
  ) {
    await this.requireFestivalCalendarEntry(id);
    return this.prisma.festivalCalendar.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async removeFestivalCalendarEntry(id: string): Promise<void> {
    await this.requireFestivalCalendarEntry(id);
    await this.prisma.festivalCalendar.delete({ where: { id } });
  }

  private async requireFestivalCalendarEntry(id: string) {
    const entry = await this.prisma.festivalCalendar.findUnique({
      where: { id },
    });
    if (!entry)
      throw new NotFoundException(`Festival calendar entry ${id} not found`);
    return entry;
  }
}
