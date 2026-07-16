import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { GeoService } from '../geo/geo.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResult, paginate } from '../common/dto/pagination-query.dto';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';
import { CreateShgDto } from './dto/create-shg.dto';
import { QueryShgDto } from './dto/query-shg.dto';
import { UpdateShgDto } from './dto/update-shg.dto';

@Injectable()
export class ShgsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  async create(contactUserId: string, dto: CreateShgDto) {
    assertLatLngPair(dto.lat, dto.lng);

    const shg = await this.prisma.shg.create({
      data: {
        name: dto.name,
        mepmaRegistrationNumber: dto.mepmaRegistrationNumber,
        type: dto.type,
        productionCapacityNote: dto.productionCapacityNote,
        bankAccountNumber: dto.bankAccountNumber,
        bankIfsc: dto.bankIfsc,
        districtId: dto.districtId,
        ulbId: dto.ulbId,
        mandalId: dto.mandalId,
        contactUserId,
      },
    });

    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.geo.setLocation('shg', shg.id, { lat: dto.lat, lng: dto.lng });
    }

    await this.ensureShgRole(contactUserId);

    return this.findOne(shg.id);
  }

  async findAllInScope(
    scope: RequestScope,
    query: QueryShgDto,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ShgWhereInput = {
      ...scopeWhere(scope),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [total, shgs] = await this.prisma.$transaction([
      this.prisma.shg.count({ where }),
      this.prisma.shg.findMany({
        where,
        include: { district: true, ulb: true, mandal: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
    ]);

    const withLocations = await this.attachLocations(shgs);
    return paginate(withLocations, total, query);
  }

  async findOne(id: string) {
    const shg = await this.prisma.shg.findUnique({
      where: { id },
      include: { district: true, ulb: true, mandal: true },
    });
    if (!shg) {
      throw new NotFoundException(`SHG ${id} not found`);
    }
    const [withLocation] = await this.attachLocations([shg]);
    return withLocation;
  }

  async update(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateShgDto,
  ) {
    const shg = await this.requireOwnedOrAdmin(id, requesterId, isAdmin);
    assertLatLngPair(dto.lat, dto.lng);

    const updated = await this.prisma.shg.update({
      where: { id: shg.id },
      data: {
        name: dto.name,
        mepmaRegistrationNumber: dto.mepmaRegistrationNumber,
        type: dto.type,
        productionCapacityNote: dto.productionCapacityNote,
        bankAccountNumber: dto.bankAccountNumber,
        bankIfsc: dto.bankIfsc,
        districtId: dto.districtId,
        ulbId: dto.ulbId,
        mandalId: dto.mandalId,
        isActive: dto.isActive,
      },
    });

    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.geo.setLocation('shg', updated.id, {
        lat: dto.lat,
        lng: dto.lng,
      });
    }

    return this.findOne(updated.id);
  }

  async remove(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const shg = await this.requireOwnedOrAdmin(id, requesterId, isAdmin);
    await this.prisma.shg.delete({ where: { id: shg.id } });
  }

  private async requireOwnedOrAdmin(
    id: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const shg = await this.prisma.shg.findUnique({ where: { id } });
    if (!shg) {
      throw new NotFoundException(`SHG ${id} not found`);
    }
    if (!isAdmin && shg.contactUserId !== requesterId) {
      throw new ForbiddenException(
        'Only the SHG contact or an admin can modify this SHG',
      );
    }
    return shg;
  }

  private async ensureShgRole(userId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { name: 'SHG' } });
    if (!role) return; // role seed not run — nothing to assign, non-fatal
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id },
    });
    if (!existing) {
      await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    }
  }

  private async attachLocations<T extends { id: string }>(
    shgs: T[],
  ): Promise<(T & { location: { lat: number; lng: number } | null })[]> {
    return Promise.all(
      shgs.map(async (shg) => ({
        ...shg,
        location: await this.geo.getLocation('shg', shg.id),
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

function scopeWhere(scope: RequestScope): Prisma.ShgWhereInput {
  switch (scope.kind) {
    case 'global':
      return {};
    case 'district':
      return { districtId: { in: scope.districtIds } };
    case 'ulb':
      return { ulbId: { in: scope.ulbIds } };
    case 'self':
      return { contactUserId: scope.userId };
  }
}
