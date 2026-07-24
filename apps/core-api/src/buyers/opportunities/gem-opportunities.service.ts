import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination-query.dto';
import { QueryGemOpportunityDto } from './dto/query-gem-opportunity.dto';

const gemOpportunityInclude = {
  buyer: { include: { district: true } },
  category: true,
} satisfies Prisma.GemOpportunityInclude;

/** Read-only: opportunities today are only created via the seed/import path
 * (real GeM API ingestion is T21's scope) — see ADR-0025. */
@Injectable()
export class GemOpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

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
