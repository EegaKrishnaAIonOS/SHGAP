import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MarketPriceRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrivalDate: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
}

export interface MarketPricesQuery {
  district?: string;
  commodity?: string;
  limit?: number;
}

/**
 * Proxies to ml-services' `GET /market-intelligence/prices` (T21) — real
 * Agmarknet price history that T14 has been ingesting since Sprint 3
 * (ADR-0023) but never had a dashboard-facing read path until now (see
 * ADR-0030). Best-effort like `CategorizationService`: an unreachable
 * ml-services shouldn't break a government dashboard tile over one panel,
 * so this returns an empty list rather than throwing.
 */
@Injectable()
export class MarketPricesService {
  private readonly logger = new Logger(MarketPricesService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('ML_SERVICES_URL');
  }

  async getPrices(query: MarketPricesQuery): Promise<MarketPriceRecord[]> {
    const qs = new URLSearchParams();
    if (query.district) qs.set('district', query.district);
    if (query.commodity) qs.set('commodity', query.commodity);
    if (query.limit) qs.set('limit', String(query.limit));

    try {
      const response = await fetch(
        `${this.baseUrl}/market-intelligence/prices?${qs.toString()}`,
      );
      if (!response.ok) {
        this.logger.warn(
          `ml-services /market-intelligence/prices returned ${response.status}`,
        );
        return [];
      }
      const body = (await response.json()) as {
        prices: Array<{
          state: string;
          district: string;
          market: string;
          commodity: string;
          variety: string;
          arrival_date: string;
          min_price: number;
          max_price: number;
          modal_price: number;
        }>;
      };
      return body.prices.map((p) => ({
        state: p.state,
        district: p.district,
        market: p.market,
        commodity: p.commodity,
        variety: p.variety,
        arrivalDate: p.arrival_date,
        minPrice: p.min_price,
        maxPrice: p.max_price,
        modalPrice: p.modal_price,
      }));
    } catch (err) {
      this.logger.warn(
        `ml-services /market-intelligence/prices unreachable: ${(err as Error).message}`,
      );
      return [];
    }
  }
}
