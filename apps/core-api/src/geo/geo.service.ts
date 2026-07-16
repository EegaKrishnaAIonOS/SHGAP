import { Injectable } from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Tables with a PostGIS `location geometry(Point, 4326)` column (see ADR-0016 —
 * Prisma's schema DSL can't model these, so every read/write goes through raw SQL). */
type GeoTable = 'shg' | 'products' | 'buyers';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  async setLocation(
    table: GeoTable,
    id: string,
    { lat, lng }: LatLng,
  ): Promise<void> {
    const tableIdentifier = Prisma.raw(table);
    await this.prisma.$executeRaw`
      UPDATE ${tableIdentifier}
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
      WHERE id = ${id}::uuid
    `;
  }

  async getLocation(table: GeoTable, id: string): Promise<LatLng | null> {
    const tableIdentifier = Prisma.raw(table);
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM ${tableIdentifier}
      WHERE id = ${id}::uuid AND location IS NOT NULL
    `;
    return rows[0] ?? null;
  }

  /** Returns the ids of rows in `table` within `radiusKm` of the given point, nearest first. */
  async findNearbyIds(
    table: GeoTable,
    { lat, lng }: LatLng,
    radiusKm: number,
  ): Promise<{ id: string; distanceKm: number }[]> {
    const tableIdentifier = Prisma.raw(table);
    const radiusMeters = radiusKm * 1000;
    return this.prisma.$queryRaw<{ id: string; distanceKm: number }[]>`
      SELECT id, ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS "distanceKm"
      FROM ${tableIdentifier}
      WHERE location IS NOT NULL
        AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
      ORDER BY "distanceKm" ASC
    `;
  }
}
