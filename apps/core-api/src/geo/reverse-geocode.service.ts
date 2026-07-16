import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LatLng } from './geo.service';

export interface ReverseGeocodeResult {
  suggestedDistrictId: string | null;
  suggestedDistrictName: string | null;
  matchedAddressField: string | null;
  rawAddress: Record<string, string>;
}

/**
 * Best-effort reverse geocoding via OSM Nominatim (free, no API key — see
 * ADR-0013's "live where available, simulated otherwise" integration policy).
 *
 * We do NOT have administrative boundary polygons for the pilot districts/
 * ULBs/mandals seeded (T02 only seeded names/codes), so this cannot
 * authoritatively resolve a point to one of our seeded districts. Instead it
 * asks Nominatim for the real-world district/county name at that point and
 * fuzzy-matches it against our 3 pilot districts, returning a *suggestion*
 * for the caller (e.g. the registration form) to prefill and let the user
 * confirm/override — SHG/Product creation still requires an explicit,
 * FK-validated districtId regardless of what this returns.
 */
@Injectable()
export class ReverseGeocodeService {
  private readonly logger = new Logger(ReverseGeocodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reverse({ lat, lng }: LatLng): Promise<ReverseGeocodeResult> {
    const empty: ReverseGeocodeResult = {
      suggestedDistrictId: null,
      suggestedDistrictName: null,
      matchedAddressField: null,
      rawAddress: {},
    };

    const address = await this.fetchNominatimAddress(lat, lng);
    if (!address) return empty;

    const districts = await this.prisma.district.findMany();
    const candidateFields = [
      'state_district',
      'county',
      'city_district',
      'city',
    ] as const;

    for (const field of candidateFields) {
      const value = address[field];
      if (!value) continue;
      const match = districts.find((d) =>
        normalize(value).includes(normalize(d.name)),
      );
      if (match) {
        return {
          suggestedDistrictId: match.id,
          suggestedDistrictName: match.name,
          matchedAddressField: field,
          rawAddress: address,
        };
      }
    }

    return { ...empty, rawAddress: address };
  }

  private async fetchNominatimAddress(
    lat: number,
    lng: number,
  ): Promise<Record<string, string> | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    try {
      const response = await fetch(url, {
        headers: {
          // Nominatim's usage policy requires a descriptive User-Agent identifying the application.
          'User-Agent':
            'SHGAP-POC/0.1 (AI-enabled Smart Market Linkage Platform for SHG Products)',
        },
      });
      if (!response.ok) {
        this.logger.warn(`Nominatim returned ${response.status}`);
        return null;
      }
      const body = (await response.json()) as {
        address?: Record<string, string>;
      };
      return body.address ?? null;
    } catch (err) {
      this.logger.warn(
        `Nominatim reverse geocode failed: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bdistrict\b/g, '')
    .trim();
}
