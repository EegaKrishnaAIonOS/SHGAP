import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { GeoService, LatLng } from '../geo/geo.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResult, paginate } from '../common/dto/pagination-query.dto';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productInclude = {
  shg: { include: { district: true, ulb: true } },
  category: true,
  images: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  async create(requesterId: string, isAdmin: boolean, dto: CreateProductDto) {
    assertLatLngPair(dto.lat, dto.lng);
    const shg = await this.requireShgOwnership(dto.shgId, requesterId, isAdmin);

    const product = await this.prisma.product.create({
      data: {
        shgId: shg.id,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        unit: dto.unit,
        price: dto.price,
        moq: dto.moq ?? 1,
        stock: dto.stock ?? 0,
        isAvailable: dto.isAvailable ?? true,
      },
    });

    const point = await this.resolveInitialLocation(shg.id, dto);
    if (point) {
      await this.geo.setLocation('products', product.id, point);
    }

    return this.findOne(product.id);
  }

  async findAllInScope(
    scope: RequestScope,
    query: QueryProductDto,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ProductWhereInput = {
      ...scopeWhere(scope),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.shgId ? { shgId: query.shgId } : {}),
      ...(query.districtId ? { shg: { districtId: query.districtId } } : {}),
      ...(query.isAvailable !== undefined
        ? { isAvailable: query.isAvailable }
        : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
    ]);

    return paginate(await this.attachLocations(products), total, query);
  }

  async findNearby(point: LatLng, radiusKm: number) {
    const nearby = await this.geo.findNearbyIds('products', point, radiusKm);
    if (nearby.length === 0) return [];

    const distanceById = new Map(nearby.map((n) => [n.id, n.distanceKm]));
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...distanceById.keys()] }, isAvailable: true },
      include: productInclude,
    });

    return products
      .map((p) => ({ ...p, distanceKm: distanceById.get(p.id) ?? null }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    const [withLocation] = await this.attachLocations([product]);
    return withLocation;
  }

  async update(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: UpdateProductDto,
  ) {
    assertLatLngPair(dto.lat, dto.lng);
    const product = await this.requireOwnedOrAdmin(id, requesterId, isAdmin);

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        unit: dto.unit,
        price: dto.price,
        moq: dto.moq,
        stock: dto.stock,
        isAvailable: dto.isAvailable,
      },
    });

    if (dto.lat !== undefined && dto.lng !== undefined) {
      await this.geo.setLocation('products', updated.id, {
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
    const product = await this.requireOwnedOrAdmin(id, requesterId, isAdmin);
    await this.prisma.product.delete({ where: { id: product.id } });
  }

  /** Used by the image-upload endpoint to check the caller owns the product's SHG. */
  async requireOwnedOrAdmin(id: string, requesterId: string, isAdmin: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { shg: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    if (!isAdmin && product.shg.contactUserId !== requesterId) {
      throw new ForbiddenException(
        "Only the product's SHG contact or an admin can modify it",
      );
    }
    return product;
  }

  private async requireShgOwnership(
    shgId: string,
    requesterId: string,
    isAdmin: boolean,
  ) {
    const shg = await this.prisma.shg.findUnique({ where: { id: shgId } });
    if (!shg) {
      throw new NotFoundException(`SHG ${shgId} not found`);
    }
    if (!isAdmin && shg.contactUserId !== requesterId) {
      throw new ForbiddenException(
        'Only the SHG contact or an admin can add products for this SHG',
      );
    }
    return shg;
  }

  /** Falls back to the parent SHG's own location if the product doesn't specify its own. */
  private async resolveInitialLocation(
    shgId: string,
    dto: CreateProductDto,
  ): Promise<LatLng | null> {
    if (dto.lat !== undefined && dto.lng !== undefined) {
      return { lat: dto.lat, lng: dto.lng };
    }
    return this.geo.getLocation('shg', shgId);
  }

  private async attachLocations<T extends { id: string }>(
    products: T[],
  ): Promise<(T & { location: LatLng | null })[]> {
    return Promise.all(
      products.map(async (product) => ({
        ...product,
        location: await this.geo.getLocation('products', product.id),
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

function scopeWhere(scope: RequestScope): Prisma.ProductWhereInput {
  switch (scope.kind) {
    case 'global':
      return {};
    case 'district':
      return { shg: { districtId: { in: scope.districtIds } } };
    case 'ulb':
      return { shg: { ulbId: { in: scope.ulbIds } } };
    case 'self':
      return { shg: { contactUserId: scope.userId } };
  }
}
