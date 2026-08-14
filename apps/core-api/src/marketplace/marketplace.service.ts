import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../common/dto/pagination-query.dto';
import { MasterDataService } from '../master-data/master-data.service';
import { ProductsService } from '../products/products.service';
import { ShgsService } from '../shgs/shgs.service';
import { QueryMarketplaceProductsDto } from './dto/query-marketplace-products.dto';

interface ShgLike {
  id: string;
  name: string;
  type: string;
  productionCapacityNote: string | null;
  district?: unknown;
  ulb?: unknown;
  mandal?: unknown;
  [key: string]: unknown;
}

/** Thin composition layer over the existing product/SHG/master-data
 * services for the public marketplace (Phase 1, read-only) — no new
 * persistence of its own. Keeping this as a separate module/service rather
 * than adding routes to the existing controllers means today's authenticated
 * behavior there is untouched. */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly products: ProductsService,
    private readonly shgs: ShgsService,
    private readonly masterData: MasterDataService,
  ) {}

  categories() {
    return this.masterData.categories();
  }

  districts() {
    return this.masterData.districts();
  }

  async listProducts(
    query: QueryMarketplaceProductsDto,
  ): Promise<PaginatedResult<unknown>> {
    const result = await this.products.findAllPublic(query);
    return { ...result, items: result.items.map(sanitizeProduct) };
  }

  async getProduct(id: string) {
    return sanitizeProduct(await this.products.findOne(id));
  }

  async getStorefront(shgId: string) {
    const [shg, products] = await Promise.all([
      this.shgs.findPublicSummary(shgId),
      this.products.findAllPublic({
        shgId,
        page: 1,
        pageSize: 100,
        skip: 0,
      }),
    ]);
    return { shg, products: products.items.map(sanitizeProduct) };
  }
}

/** `ProductsService.findAllPublic`/`findOne` reuse `productInclude`, which
 * nests the *full* `Shg` row (no `select`) — fine for the authenticated
 * routes that already return it today, but wrong for an anonymous
 * marketplace visitor: it would otherwise leak `bankAccountNumber`/
 * `bankIfsc` (encrypted ciphertext, but still not public data) and
 * `contactUserId` (an internal user id) on every product's nested SHG.
 * Redacts down to the same public-safe shape `ShgsService.findPublicSummary`
 * already exposes on the storefront endpoint, so a marketplace visitor sees
 * one consistent SHG profile everywhere. */
function sanitizeProduct<T extends { shg?: unknown }>(product: T): T {
  if (!product || typeof product !== 'object' || !product.shg) return product;
  const shg = product.shg as ShgLike;
  return {
    ...product,
    shg: {
      id: shg.id,
      name: shg.name,
      type: shg.type,
      productionCapacityNote: shg.productionCapacityNote,
      district: shg.district,
      ulb: shg.ulb,
      mandal: shg.mandal,
    },
  };
}