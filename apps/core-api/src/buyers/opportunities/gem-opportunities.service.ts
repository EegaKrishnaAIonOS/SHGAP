import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationEvent, Prisma } from '@shgap/database';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDispatchClient } from '../../common/notifications/notification-dispatch.client';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination-query.dto';
import { CreateGemOpportunityDto } from './dto/create-gem-opportunity.dto';
import { ImportGemOpportunitiesDto } from './dto/import-gem-opportunities.dto';
import { QueryGemOpportunityDto } from './dto/query-gem-opportunity.dto';

const gemOpportunityInclude = {
  buyer: { include: { district: true } },
  category: true,
} satisfies Prisma.GemOpportunityInclude;

/** Real write path landed in T21 (ADR-0030) — see ADR-0025 for why it
 * didn't exist before this. */
@Injectable()
export class GemOpportunitiesService {
  private readonly logger = new Logger(GemOpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchClient,
  ) {}

  async create(dto: CreateGemOpportunityDto) {
    const opportunity = await this.prisma.gemOpportunity.create({
      data: {
        buyerId: dto.buyerId,
        categoryId: dto.categoryId,
        referenceNumber: dto.referenceNumber,
        title: dto.title,
        description: dto.description,
        quantityRequired: dto.quantityRequired,
        unit: dto.unit,
        estimatedValue: dto.estimatedValue,
        submissionDeadline: new Date(dto.submissionDeadline),
        status: dto.status,
        isSimulated: dto.isSimulated ?? false,
      },
      include: gemOpportunityInclude,
    });

    // Best-effort — see NotificationDispatchClient's own docstring for why
    // a failure here never surfaces as an error on this request.
    await this.notifyMatchingShgs(opportunity);

    return opportunity;
  }

  /** Best-effort bulk create — one bad row doesn't block the rest; failures
   * are reported per-index (same shape as BuyersService.importMany). */
  async importMany(dto: ImportGemOpportunitiesDto) {
    const created: unknown[] = [];
    const failed: { index: number; error: string }[] = [];

    for (const [index, opportunityDto] of dto.opportunities.entries()) {
      try {
        created.push(await this.create(opportunityDto));
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

  /**
   * Maps the opportunity's category to every SHG with a product in that
   * category, and sends each one a real TENDER_OPPORTUNITY alert through
   * the notification engine (T13) — the templates and channel routing for
   * this event already existed, unused, since ADR-0022; this is the first
   * real caller. An opportunity with no `categoryId` matches nothing —
   * honest, not an error, since GeM tenders aren't always category-tagged.
   */
  private async notifyMatchingShgs(opportunity: {
    id: string;
    categoryId: string | null;
    title: string;
    submissionDeadline: Date;
  }): Promise<void> {
    if (!opportunity.categoryId) return;

    const matchingShgs = await this.prisma.shg.findMany({
      where: {
        isActive: true,
        products: { some: { categoryId: opportunity.categoryId } },
      },
      select: { contactUserId: true },
      distinct: ['contactUserId'],
    });

    const context = {
      tenderTitle: opportunity.title,
      deadline: opportunity.submissionDeadline.toISOString().slice(0, 10),
    };

    for (const shg of matchingShgs) {
      const delivered = await this.notifications.dispatch(
        shg.contactUserId,
        NotificationEvent.TENDER_OPPORTUNITY,
        context,
      );
      if (!delivered) {
        this.logger.warn(
          `Tender-opportunity alert not delivered to user ${shg.contactUserId} for opportunity ${opportunity.id}`,
        );
      }
    }
  }

  async findAll(
    query: QueryGemOpportunityDto,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.GemOpportunityWhereInput = {
      ...(query.buyerId ? { buyerId: query.buyerId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.districtId ? { buyer: { districtId: query.districtId } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, opportunities] = await this.prisma.$transaction([
      this.prisma.gemOpportunity.count({ where }),
      this.prisma.gemOpportunity.findMany({
        where,
        include: gemOpportunityInclude,
        orderBy: { submissionDeadline: 'asc' },
        skip: query.skip,
        take: query.pageSize,
      }),
    ]);

    return paginate(opportunities, total, query);
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.gemOpportunity.findUnique({
      where: { id },
      include: gemOpportunityInclude,
    });
    if (!opportunity) {
      throw new NotFoundException(`GeM opportunity ${id} not found`);
    }
    return opportunity;
  }
}
