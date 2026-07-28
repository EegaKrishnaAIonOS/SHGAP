import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';
import { PaginatedResult, paginate } from '../common/dto/pagination-query.dto';
import { cacheAside, cacheKey } from './cache.util';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { SalesTrendQueryDto } from './dto/sales-trend-query.dto';
import { combineWhere, scopeConditions, toNumber } from './where-builder.util';

// 5 minutes: fresh enough that a district official refreshing the page
// after a scheduled view refresh sees new numbers promptly, long enough
// that a dashboard full of tiles/charts loading in parallel hits Redis
// instead of Postgres for every one of them.
const CACHE_TTL_SECONDS = 300;

type MaterializedView =
  'mv_sales_facts' | 'mv_enquiry_facts' | 'mv_recommendation_facts';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async districtSales(scope: RequestScope, filters: AnalyticsFilterDto) {
    return cacheAside(
      this.redis,
      cacheKey('district-sales', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`district_id`,
            Prisma.sql`ulb_id`,
          ),
          ...this.dateAndScopeConditions(filters, Prisma.sql`sale_date`),
        ];
        const rows = await this.prisma.$queryRaw<
          {
            district_id: string;
            district_name: string;
            order_count: bigint;
            total_quantity: string;
            total_amount: string;
          }[]
        >(Prisma.sql`
          SELECT district_id, district_name,
                 count(DISTINCT sale_id) AS order_count,
                 sum(quantity) AS total_quantity,
                 sum(total_amount) AS total_amount
          FROM mv_sales_facts
          ${combineWhere(conditions)}
          GROUP BY district_id, district_name
          ORDER BY sum(total_amount) DESC
        `);
        return rows.map((r) => ({
          districtId: r.district_id,
          districtName: r.district_name,
          orderCount: toNumber(r.order_count),
          totalQuantity: toNumber(r.total_quantity),
          totalAmount: toNumber(r.total_amount),
        }));
      },
    );
  }

  async ulbSales(scope: RequestScope, filters: AnalyticsFilterDto) {
    return cacheAside(
      this.redis,
      cacheKey('ulb-sales', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`district_id`,
            Prisma.sql`ulb_id`,
          ),
          Prisma.sql`ulb_id IS NOT NULL`,
          ...this.dateAndScopeConditions(filters, Prisma.sql`sale_date`),
        ];
        const rows = await this.prisma.$queryRaw<
          {
            ulb_id: string;
            ulb_name: string;
            district_id: string;
            district_name: string;
            order_count: bigint;
            total_quantity: string;
            total_amount: string;
          }[]
        >(Prisma.sql`
          SELECT ulb_id, ulb_name, district_id, district_name,
                 count(DISTINCT sale_id) AS order_count,
                 sum(quantity) AS total_quantity,
                 sum(total_amount) AS total_amount
          FROM mv_sales_facts
          ${combineWhere(conditions)}
          GROUP BY ulb_id, ulb_name, district_id, district_name
          ORDER BY sum(total_amount) DESC
        `);
        return rows.map((r) => ({
          ulbId: r.ulb_id,
          ulbName: r.ulb_name,
          districtId: r.district_id,
          districtName: r.district_name,
          orderCount: toNumber(r.order_count),
          totalQuantity: toNumber(r.total_quantity),
          totalAmount: toNumber(r.total_amount),
        }));
      },
    );
  }

  async categorySales(scope: RequestScope, filters: AnalyticsFilterDto) {
    return cacheAside(
      this.redis,
      cacheKey('category-sales', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`district_id`,
            Prisma.sql`ulb_id`,
          ),
          ...this.dateAndScopeConditions(filters, Prisma.sql`sale_date`),
        ];
        const rows = await this.prisma.$queryRaw<
          {
            category_id: string;
            category_name: string;
            order_count: bigint;
            total_quantity: string;
            total_amount: string;
          }[]
        >(Prisma.sql`
          SELECT category_id, category_name,
                 count(DISTINCT sale_id) AS order_count,
                 sum(quantity) AS total_quantity,
                 sum(total_amount) AS total_amount
          FROM mv_sales_facts
          ${combineWhere(conditions)}
          GROUP BY category_id, category_name
          ORDER BY sum(total_amount) DESC
        `);
        return rows.map((r) => ({
          categoryId: r.category_id,
          categoryName: r.category_name,
          orderCount: toNumber(r.order_count),
          totalQuantity: toNumber(r.total_quantity),
          totalAmount: toNumber(r.total_amount),
        }));
      },
    );
  }

  async salesTrend(scope: RequestScope, filters: SalesTrendQueryDto) {
    return cacheAside(
      this.redis,
      cacheKey('sales-trend', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`district_id`,
            Prisma.sql`ulb_id`,
          ),
          ...this.dateAndScopeConditions(filters, Prisma.sql`sale_date`),
        ];
        // date_trunc's unit argument is an ordinary text parameter in
        // Postgres (not DDL/identifier syntax), so binding it via Prisma.sql
        // is safe — but it's also validated against a fixed enum at the DTO
        // layer (SalesTrendQueryDto), so this never sees arbitrary input.
        const rows = await this.prisma.$queryRaw<
          {
            bucket: Date;
            order_count: bigint;
            total_quantity: string;
            total_amount: string;
          }[]
        >(Prisma.sql`
          SELECT date_trunc(${filters.bucket}, sale_date) AS bucket,
                 count(DISTINCT sale_id) AS order_count,
                 sum(quantity) AS total_quantity,
                 sum(total_amount) AS total_amount
          FROM mv_sales_facts
          ${combineWhere(conditions)}
          GROUP BY bucket
          ORDER BY bucket ASC
        `);
        return rows.map((r) => ({
          bucket: r.bucket.toISOString(),
          orderCount: toNumber(r.order_count),
          totalQuantity: toNumber(r.total_quantity),
          totalAmount: toNumber(r.total_amount),
        }));
      },
    );
  }

  async recommendationSummary(
    scope: RequestScope,
    filters: AnalyticsFilterDto,
  ) {
    return cacheAside(
      this.redis,
      cacheKey('recommendation-summary', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`district_id`,
            Prisma.sql`ulb_id`,
          ),
          ...this.dateAndScopeConditions(filters, Prisma.sql`created_at`),
        ];
        const where = combineWhere(conditions);
        const [rows, [linkage]] = await Promise.all([
          this.prisma.$queryRaw<{ status: string; count: bigint }[]>(Prisma.sql`
            SELECT status, count(*) AS count
            FROM mv_recommendation_facts
            ${where}
            GROUP BY status
          `),
          // T20's "market linkage" panel: how many distinct SHGs/buyers have
          // at least one ACCEPTED match (coverage), plus the average match
          // score across every recommendation in scope (quality) — both real
          // fields already on the view, just not surfaced until now.
          this.prisma.$queryRaw<
            {
              avg_match_score: string | null;
              shgs_linked: bigint;
              buyers_linked: bigint;
            }[]
          >(Prisma.sql`
            SELECT
              avg(match_score) AS avg_match_score,
              count(DISTINCT shg_id) FILTER (WHERE status = 'ACCEPTED') AS shgs_linked,
              count(DISTINCT buyer_id) FILTER (WHERE status = 'ACCEPTED') AS buyers_linked
            FROM mv_recommendation_facts
            ${where}
          `),
        ]);
        const byStatus = Object.fromEntries(
          rows.map((r) => [r.status, toNumber(r.count)]),
        );
        const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
        const responded = (byStatus.ACCEPTED ?? 0) + (byStatus.REJECTED ?? 0);
        return {
          total,
          pending: byStatus.PENDING ?? 0,
          accepted: byStatus.ACCEPTED ?? 0,
          rejected: byStatus.REJECTED ?? 0,
          expired: byStatus.EXPIRED ?? 0,
          // null (not 0) when nothing has been responded to yet — an honest
          // "no data" rather than a misleading 0% acceptance rate.
          acceptanceRate: responded > 0 ? byStatus.ACCEPTED! / responded : null,
          avgMatchScore:
            linkage?.avg_match_score != null
              ? Number(linkage.avg_match_score)
              : null,
          shgsLinked: toNumber(linkage?.shgs_linked),
          buyersLinked: toNumber(linkage?.buyers_linked),
        };
      },
    );
  }

  /** T20's "enquiries generated" KPI tile — total buyer enquiries in scope,
   * broken down by status, from mv_enquiry_facts (already built for T18,
   * never surfaced as an aggregate until now). */
  async enquirySummary(scope: RequestScope, filters: AnalyticsFilterDto) {
    return cacheAside(
      this.redis,
      cacheKey('enquiry-summary', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`district_id`,
            Prisma.sql`ulb_id`,
          ),
          ...this.dateAndScopeConditions(filters, Prisma.sql`created_at`),
        ];
        const rows = await this.prisma.$queryRaw<
          { status: string; count: bigint }[]
        >(Prisma.sql`
          SELECT status, count(*) AS count
          FROM mv_enquiry_facts
          ${combineWhere(conditions)}
          GROUP BY status
        `);
        const byStatus = Object.fromEntries(
          rows.map((r) => [r.status, toNumber(r.count)]),
        );
        return {
          total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
          open: byStatus.OPEN ?? 0,
          responded: byStatus.RESPONDED ?? 0,
          closed: byStatus.CLOSED ?? 0,
        };
      },
    );
  }

  async shgs(
    scope: RequestScope,
    filters: AnalyticsFilterDto,
  ): Promise<PaginatedResult<unknown>> {
    return cacheAside(
      this.redis,
      cacheKey('shgs', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = scopeConditions(
          scope,
          Prisma.sql`shg.district_id`,
          Prisma.sql`shg.ulb_id`,
        );
        if (filters.districtId) {
          conditions.push(
            Prisma.sql`shg.district_id = ${filters.districtId}::uuid`,
          );
        }
        if (filters.ulbId) {
          conditions.push(Prisma.sql`shg.ulb_id = ${filters.ulbId}::uuid`);
        }
        const where = combineWhere(conditions);

        const [rows, countRows] = await Promise.all([
          this.prisma.$queryRaw<
            {
              id: string;
              name: string;
              type: string;
              is_active: boolean;
              district_id: string;
              district_name: string;
              ulb_id: string | null;
              ulb_name: string | null;
              product_count: bigint;
              total_sales_amount: string;
              total_sales_quantity: string;
              order_count: bigint;
              enquiry_count: bigint;
            }[]
          >(Prisma.sql`
            SELECT shg.id, shg.name, shg.type, shg.is_active,
                   shg.district_id, d.name AS district_name,
                   shg.ulb_id, u.name AS ulb_name,
                   COALESCE(prod.product_count, 0) AS product_count,
                   COALESCE(sales.total_amount, 0) AS total_sales_amount,
                   COALESCE(sales.total_quantity, 0) AS total_sales_quantity,
                   COALESCE(sales.order_count, 0) AS order_count,
                   COALESCE(enq.enquiry_count, 0) AS enquiry_count
            FROM shg
            JOIN districts d ON d.id = shg.district_id
            LEFT JOIN ulbs u ON u.id = shg.ulb_id
            LEFT JOIN (
              SELECT shg_id, count(*) AS product_count FROM products GROUP BY shg_id
            ) prod ON prod.shg_id = shg.id
            LEFT JOIN (
              SELECT shg_id, sum(total_amount) AS total_amount, sum(quantity) AS total_quantity,
                     count(DISTINCT sale_id) AS order_count
              FROM mv_sales_facts GROUP BY shg_id
            ) sales ON sales.shg_id = shg.id
            LEFT JOIN (
              SELECT shg_id, count(*) AS enquiry_count FROM mv_enquiry_facts GROUP BY shg_id
            ) enq ON enq.shg_id = shg.id
            ${where}
            ORDER BY COALESCE(sales.total_amount, 0) DESC
            LIMIT ${filters.pageSize} OFFSET ${filters.skip}
          `),
          this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT count(*) AS count FROM shg ${where}
          `),
        ]);

        const items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          isActive: r.is_active,
          districtId: r.district_id,
          districtName: r.district_name,
          ulbId: r.ulb_id,
          ulbName: r.ulb_name,
          productCount: toNumber(r.product_count),
          totalSalesAmount: toNumber(r.total_sales_amount),
          totalSalesQuantity: toNumber(r.total_sales_quantity),
          orderCount: toNumber(r.order_count),
          enquiryCount: toNumber(r.enquiry_count),
        }));
        return paginate(items, toNumber(countRows[0]?.count), filters);
      },
    );
  }

  async shgDetail(id: string, scope: RequestScope) {
    const conditions = [
      Prisma.sql`shg.id = ${id}::uuid`,
      ...scopeConditions(
        scope,
        Prisma.sql`shg.district_id`,
        Prisma.sql`shg.ulb_id`,
      ),
    ];
    const shgRows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        type: string;
        is_active: boolean;
        district_id: string;
        district_name: string;
        ulb_id: string | null;
        ulb_name: string | null;
        total_sales_amount: string;
        total_sales_quantity: string;
        order_count: bigint;
        enquiry_count: bigint;
      }[]
    >(Prisma.sql`
      SELECT shg.id, shg.name, shg.type, shg.is_active,
             shg.district_id, d.name AS district_name,
             shg.ulb_id, u.name AS ulb_name,
             COALESCE(sales.total_amount, 0) AS total_sales_amount,
             COALESCE(sales.total_quantity, 0) AS total_sales_quantity,
             COALESCE(sales.order_count, 0) AS order_count,
             COALESCE(enq.enquiry_count, 0) AS enquiry_count
      FROM shg
      JOIN districts d ON d.id = shg.district_id
      LEFT JOIN ulbs u ON u.id = shg.ulb_id
      LEFT JOIN (
        SELECT shg_id, sum(total_amount) AS total_amount, sum(quantity) AS total_quantity,
               count(DISTINCT sale_id) AS order_count
        FROM mv_sales_facts GROUP BY shg_id
      ) sales ON sales.shg_id = shg.id
      LEFT JOIN (
        SELECT shg_id, count(*) AS enquiry_count FROM mv_enquiry_facts GROUP BY shg_id
      ) enq ON enq.shg_id = shg.id
      ${combineWhere(conditions)}
    `);
    const shg = shgRows[0];
    if (!shg) {
      throw new NotFoundException(`SHG ${id} not found`);
    }

    const products = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        category_name: string;
        price: string;
        units_sold: string;
        total_revenue: string;
      }[]
    >(Prisma.sql`
      SELECT p.id, p.name, c.name AS category_name, p.price,
             COALESCE(sales.total_quantity, 0) AS units_sold,
             COALESCE(sales.total_amount, 0) AS total_revenue
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN (
        SELECT product_id, sum(quantity) AS total_quantity, sum(total_amount) AS total_amount
        FROM mv_sales_facts GROUP BY product_id
      ) sales ON sales.product_id = p.id
      WHERE p.shg_id = ${id}::uuid
      ORDER BY COALESCE(sales.total_quantity, 0) DESC
    `);

    return {
      id: shg.id,
      name: shg.name,
      type: shg.type,
      isActive: shg.is_active,
      districtId: shg.district_id,
      districtName: shg.district_name,
      ulbId: shg.ulb_id,
      ulbName: shg.ulb_name,
      totalSalesAmount: toNumber(shg.total_sales_amount),
      totalSalesQuantity: toNumber(shg.total_sales_quantity),
      orderCount: toNumber(shg.order_count),
      enquiryCount: toNumber(shg.enquiry_count),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category_name,
        price: toNumber(p.price),
        unitsSold: toNumber(p.units_sold),
        totalRevenue: toNumber(p.total_revenue),
      })),
    };
  }

  async products(
    scope: RequestScope,
    filters: AnalyticsFilterDto,
  ): Promise<PaginatedResult<unknown>> {
    return cacheAside(
      this.redis,
      cacheKey('products', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const conditions = scopeConditions(
          scope,
          Prisma.sql`shg.district_id`,
          Prisma.sql`shg.ulb_id`,
        );
        if (filters.districtId) {
          conditions.push(
            Prisma.sql`shg.district_id = ${filters.districtId}::uuid`,
          );
        }
        if (filters.ulbId) {
          conditions.push(Prisma.sql`shg.ulb_id = ${filters.ulbId}::uuid`);
        }
        if (filters.categoryId) {
          conditions.push(
            Prisma.sql`p.category_id = ${filters.categoryId}::uuid`,
          );
        }
        const where = combineWhere(conditions);

        const [rows, countRows] = await Promise.all([
          this.prisma.$queryRaw<
            {
              id: string;
              name: string;
              category_id: string;
              category_name: string;
              shg_id: string;
              shg_name: string;
              price: string;
              is_available: boolean;
              units_sold: string;
              total_revenue: string;
              enquiry_count: bigint;
            }[]
          >(Prisma.sql`
            SELECT p.id, p.name, p.category_id, c.name AS category_name,
                   p.shg_id, shg.name AS shg_name, p.price, p.is_available,
                   COALESCE(sales.total_quantity, 0) AS units_sold,
                   COALESCE(sales.total_amount, 0) AS total_revenue,
                   COALESCE(enq.enquiry_count, 0) AS enquiry_count
            FROM products p
            JOIN categories c ON c.id = p.category_id
            JOIN shg ON shg.id = p.shg_id
            LEFT JOIN (
              SELECT product_id, sum(quantity) AS total_quantity, sum(total_amount) AS total_amount
              FROM mv_sales_facts GROUP BY product_id
            ) sales ON sales.product_id = p.id
            LEFT JOIN (
              SELECT product_id, count(*) AS enquiry_count FROM mv_enquiry_facts
              WHERE product_id IS NOT NULL GROUP BY product_id
            ) enq ON enq.product_id = p.id
            ${where}
            ORDER BY COALESCE(sales.total_quantity, 0) DESC
            LIMIT ${filters.pageSize} OFFSET ${filters.skip}
          `),
          this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT count(*) AS count FROM products p JOIN shg ON shg.id = p.shg_id ${where}
          `),
        ]);

        const items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          categoryId: r.category_id,
          categoryName: r.category_name,
          shgId: r.shg_id,
          shgName: r.shg_name,
          price: toNumber(r.price),
          isAvailable: r.is_available,
          unitsSold: toNumber(r.units_sold),
          totalRevenue: toNumber(r.total_revenue),
          enquiryCount: toNumber(r.enquiry_count),
        }));
        return paginate(items, toNumber(countRows[0]?.count), filters);
      },
    );
  }

  async buyers(
    scope: RequestScope,
    filters: AnalyticsFilterDto,
  ): Promise<PaginatedResult<unknown>> {
    return cacheAside(
      this.redis,
      cacheKey('buyers', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        // Buyers aren't scoped to a district the way SHGs are (a buyer's
        // districtId is nullable — state-level buyers have none at all), so
        // scope narrows by the buyer's own district_id only when it's set,
        // rather than joining through an SHG/ULB relationship that doesn't
        // exist for buyers.
        const conditions = scopeConditions(
          scope,
          Prisma.sql`b.district_id`,
          Prisma.sql`b.district_id`,
        );
        if (filters.districtId) {
          conditions.push(
            Prisma.sql`b.district_id = ${filters.districtId}::uuid`,
          );
        }
        const where = combineWhere(conditions);

        const [rows, countRows] = await Promise.all([
          this.prisma.$queryRaw<
            {
              id: string;
              name: string;
              type: string;
              organization: string | null;
              order_count: bigint;
              total_spend: string;
              enquiry_count: bigint;
              recommendations_received: bigint;
              recommendations_accepted: bigint;
            }[]
          >(Prisma.sql`
            SELECT b.id, b.name, b.type, b.organization,
                   COALESCE(sales.order_count, 0) AS order_count,
                   COALESCE(sales.total_amount, 0) AS total_spend,
                   COALESCE(enq.enquiry_count, 0) AS enquiry_count,
                   COALESCE(rec.recommendations_received, 0) AS recommendations_received,
                   COALESCE(rec.recommendations_accepted, 0) AS recommendations_accepted
            FROM buyers b
            LEFT JOIN (
              SELECT buyer_id, count(DISTINCT sale_id) AS order_count, sum(total_amount) AS total_amount
              FROM mv_sales_facts WHERE buyer_id IS NOT NULL GROUP BY buyer_id
            ) sales ON sales.buyer_id = b.id
            LEFT JOIN (
              SELECT buyer_id, count(*) AS enquiry_count FROM mv_enquiry_facts GROUP BY buyer_id
            ) enq ON enq.buyer_id = b.id
            LEFT JOIN (
              SELECT buyer_id, count(*) AS recommendations_received,
                     count(*) FILTER (WHERE status = 'ACCEPTED') AS recommendations_accepted
              FROM mv_recommendation_facts GROUP BY buyer_id
            ) rec ON rec.buyer_id = b.id
            ${where}
            ORDER BY COALESCE(sales.total_amount, 0) DESC
            LIMIT ${filters.pageSize} OFFSET ${filters.skip}
          `),
          this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT count(*) AS count FROM buyers b ${where}
          `),
        ]);

        const items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          organization: r.organization,
          orderCount: toNumber(r.order_count),
          totalSpend: toNumber(r.total_spend),
          enquiryCount: toNumber(r.enquiry_count),
          recommendationsReceived: toNumber(r.recommendations_received),
          recommendationsAccepted: toNumber(r.recommendations_accepted),
        }));
        return paginate(items, toNumber(countRows[0]?.count), filters);
      },
    );
  }

  /**
   * Real geo-tagged activity points for T19's heat map — SHGs weighted by
   * sales amount, buyers weighted by recommendations received. Reads
   * location straight off `shg`/`buyers` (`ST_X`/`ST_Y`, matching
   * GeoService's own convention for PostGIS columns Prisma can't model)
   * rather than adding a new materialized view: at pilot scale (single-digit
   * geo-tagged rows) a live join is cheap, same reasoning ADR-0027 already
   * gave for not materializing the SHG/product/buyer dimension tables.
   * Rows with no location at all are skipped — a map has nothing useful to
   * plot for them anyway.
   */
  async geoActivity(scope: RequestScope, filters: AnalyticsFilterDto) {
    return cacheAside(
      this.redis,
      cacheKey('geo-activity', { scope, filters }),
      CACHE_TTL_SECONDS,
      async () => {
        const shgConditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`shg.district_id`,
            Prisma.sql`shg.ulb_id`,
          ),
          Prisma.sql`shg.location IS NOT NULL`,
        ];
        if (filters.districtId) {
          shgConditions.push(
            Prisma.sql`shg.district_id = ${filters.districtId}::uuid`,
          );
        }
        if (filters.ulbId) {
          shgConditions.push(Prisma.sql`shg.ulb_id = ${filters.ulbId}::uuid`);
        }

        const buyerConditions = [
          ...scopeConditions(
            scope,
            Prisma.sql`b.district_id`,
            Prisma.sql`b.district_id`,
          ),
          Prisma.sql`b.location IS NOT NULL`,
        ];
        if (filters.districtId) {
          buyerConditions.push(
            Prisma.sql`b.district_id = ${filters.districtId}::uuid`,
          );
        }

        const [shgRows, buyerRows] = await Promise.all([
          this.prisma.$queryRaw<
            {
              id: string;
              name: string;
              district_name: string;
              lat: number;
              lng: number;
              total_sales_amount: string;
            }[]
          >(Prisma.sql`
            SELECT shg.id, shg.name, d.name AS district_name,
                   ST_Y(shg.location::geometry) AS lat, ST_X(shg.location::geometry) AS lng,
                   COALESCE(sales.total_amount, 0) AS total_sales_amount
            FROM shg
            JOIN districts d ON d.id = shg.district_id
            LEFT JOIN (
              SELECT shg_id, sum(total_amount) AS total_amount FROM mv_sales_facts GROUP BY shg_id
            ) sales ON sales.shg_id = shg.id
            ${combineWhere(shgConditions)}
          `),
          this.prisma.$queryRaw<
            {
              id: string;
              name: string;
              type: string;
              lat: number;
              lng: number;
              recommendations_received: bigint;
            }[]
          >(Prisma.sql`
            SELECT b.id, b.name, b.type,
                   ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lng,
                   COALESCE(rec.recommendations_received, 0) AS recommendations_received
            FROM buyers b
            LEFT JOIN (
              SELECT buyer_id, count(*) AS recommendations_received
              FROM mv_recommendation_facts GROUP BY buyer_id
            ) rec ON rec.buyer_id = b.id
            ${combineWhere(buyerConditions)}
          `),
        ]);

        return {
          shgPoints: shgRows.map((r) => ({
            id: r.id,
            name: r.name,
            districtName: r.district_name,
            lat: r.lat,
            lng: r.lng,
            totalSalesAmount: toNumber(r.total_sales_amount),
          })),
          buyerPoints: buyerRows.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            lat: r.lat,
            lng: r.lng,
            recommendationsReceived: toNumber(r.recommendations_received),
          })),
        };
      },
    );
  }

  /** Manually refreshes all three materialized views — the same function
   * the scheduled job (app.module.ts) calls automatically. Concurrent
   * refresh requires each view's own unique index (added in the T18
   * migration) so dashboard reads are never blocked while this runs.
   * `Prisma.raw` (not `$executeRawUnsafe`) matches GeoService's convention
   * for the same reason: the identifier is drawn from this fixed, typed
   * list, never from request input. */
  async refreshViews(): Promise<{
    refreshedAt: string;
    views: MaterializedView[];
  }> {
    const views: MaterializedView[] = [
      'mv_sales_facts',
      'mv_enquiry_facts',
      'mv_recommendation_facts',
    ];
    for (const view of views) {
      await this.prisma
        .$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY ${Prisma.raw(view)}`;
    }
    return { refreshedAt: new Date().toISOString(), views };
  }

  private dateConditions(
    filters: AnalyticsFilterDto,
    dateColumn: Prisma.Sql,
  ): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [];
    if (filters.dateFrom)
      conditions.push(Prisma.sql`${dateColumn} >= ${filters.dateFrom}`);
    if (filters.dateTo)
      conditions.push(Prisma.sql`${dateColumn} <= ${filters.dateTo}`);
    return conditions;
  }

  /**
   * Date + district/ULB/category conditions against one of the denormalized
   * fact views — every view (mv_sales_facts/mv_enquiry_facts/
   * mv_recommendation_facts) carries all three columns directly, so a caller
   * drilling into a district/ULB (T19) gets the same explicit filter
   * `scopeConditions` already applies for a district/ULB *official's*
   * jurisdiction, just driven by the query string instead of the JWT scope.
   */
  private dateAndScopeConditions(
    filters: AnalyticsFilterDto,
    dateColumn: Prisma.Sql,
  ): Prisma.Sql[] {
    const conditions = this.dateConditions(filters, dateColumn);
    if (filters.districtId) {
      conditions.push(Prisma.sql`district_id = ${filters.districtId}::uuid`);
    }
    if (filters.ulbId) {
      conditions.push(Prisma.sql`ulb_id = ${filters.ulbId}::uuid`);
    }
    if (filters.categoryId) {
      conditions.push(Prisma.sql`category_id = ${filters.categoryId}::uuid`);
    }
    return conditions;
  }
}
