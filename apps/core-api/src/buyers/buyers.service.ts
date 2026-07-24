import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { GeoService, LatLng } from '../geo/geo.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResult, paginate } from '../common/dto/pagination-query.dto';
import { BuyerDemandProfileDto } from './dto/buyer-demand-profile.dto';
import { CreateBuyerDto } from './dto/create-buyer.dto';
import { ImportBuyersDto } from './dto/import-buyers.dto';
import { QueryBuyerDto } from './dto/query-buyer.dto';
import { UpdateBuyerDto } from './dto/update-buyer.dto';

const buyerInclude = {
  district: true,
  categoryInterests: { include: { category: true } },
} satisfies Prisma.BuyerInclude;

@Injectable()
export class BuyersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  async create(dto: CreateBuyerDto) {
    assertLatLngPair(dto.lat, dto.lng);

    const buyer = await this.prisma.buyer.create({
      data: {
        name: dto.name,
        type: dto.type,
        organization: dto.organization,
        districtId: dto.districtId,
        demandProfile: toJsonDemandProfile(dto.demandProfile),
        categoryInterests: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
    });

    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.geo.setLocation('buyers', buyer.id, {
        lat: dto.lat,
        lng: dto.lng,
      });
    }

    return this.findOne(buyer.id);
  }

  /** Best-effort bulk create — one bad row doesn't block the rest; failures are reported per-index. */
  async importMany(dto: ImportBuyersDto) {
    const created: unknown[] = [];
    const failed: { index: number; error: string }[] = [];

    for (const [index, buyerDto] of dto.buyers.entries()) {
      try {
        created.push(await this.create(buyerDto));
      } catch (err) {
        failed.push({
          index,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      createdCount: created.length,
      failedCount: failed.length,
      created,
      failed,
    };
  }

  async findAll(query: QueryBuyerDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.BuyerWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.categoryId
        ? { categoryInterests: { some: { categoryId: query.categoryId } } }
        : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, buyers] = await this.prisma.$transaction([
      this.prisma.buyer.count({ where }),
      this.prisma.buyer.findMany({
        where,
        include: buyerInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
    ]);

    return paginate(await this.attachLocations(buyers), total, query);
  }

  async findOne(id: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { id },
      include: buyerInclude,
    });
    if (!buyer) {
      throw new NotFoundException(`Buyer ${id} not found`);
    }
    const [withLocation] = await this.attachLocations([buyer]);
    return withLocation;
  }

  async update(id: string, dto: UpdateBuyerDto) {
    assertLatLngPair(dto.lat, dto.lng);
    await this.requireExists(id);

    await this.prisma.buyer.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        organization: dto.organization,
        districtId: dto.districtId,
        demandProfile: toJsonDemandProfile(dto.demandProfile),
        categoryInterests: dto.categoryIds
          ? {
              deleteMany: {},
              create: dto.categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
      },
    });

    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.geo.setLocation('buyers', id, { lat: dto.lat, lng: dto.lng });
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.requireExists(id);
    await this.prisma.buyer.delete({ where: { id } });
  }

  private async requireExists(id: string) {
    const buyer = await this.prisma.buyer.findUnique({ where: { id } });
    if (!buyer) {
      throw new NotFoundException(`Buyer ${id} not found`);
    }
    return buyer;
  }

  private async attachLocations<T extends { id: string }>(
    buyers: T[],
  ): Promise<(T & { location: LatLng | null })[]> {
    return Promise.all(
      buyers.map(async (buyer) => ({
        ...buyer,
        location: await this.geo.getLocation('buyers', buyer.id),
      })),
    );
  }
}

function assertLatLngPair(lat?: number, lng?: number): void {
  if ((lat === undefined) !== (lng === undefined)) {
    throw new BadRequestException(
      'lat and lng must be provided together, or omitted both',
    );
  }
}

function toJsonDemandProfile(
  profile?: BuyerDemandProfileDto,
): Prisma.InputJsonValue | undefined {
  if (!profile) return undefined;
  return {
    typicalVolume: profile.typicalVolume,
    volumeUnit: profile.volumeUnit,
    frequency: profile.frequency,
    priceBandMin: profile.priceBandMin,
    priceBandMax: profile.priceBandMax,
  };
}
