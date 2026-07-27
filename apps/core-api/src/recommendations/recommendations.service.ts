import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { RespondRecommendationDto } from './dto/respond-recommendation.dto';

interface MlCandidate {
  buyer_id: string;
  product_id: string;
  match_score: number;
  expected_demand: number | null;
  reasons: string[];
  components: Record<string, number | null>;
}

const recommendationInclude = {
  buyer: true,
  product: true,
} satisfies Prisma.RecommendationInclude;

/**
 * ml-services computes candidates (`GET /matching/candidates`, T17); this
 * service persists them as real `Recommendation` rows and owns the
 * user-facing API + accept/reject feedback capture — the same compute/
 * persist split as CategorizationService, except this IS the primary,
 * user-facing feature (not a "hint only" proxy), so an unreachable
 * ml-services surfaces as a clear 503 rather than a silently empty list.
 */
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly baseUrl: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = config.getOrThrow<string>('ML_SERVICES_URL');
  }

  async getForShg(shgId: string, requesterId: string, isAdmin: boolean) {
    const shg = await this.requireShgAccess(shgId, requesterId, isAdmin);
    await this.refresh(shg.id);

    return this.prisma.recommendation.findMany({
      where: { shgId: shg.id },
      include: recommendationInclude,
      orderBy: { matchScore: 'desc' },
    });
  }

  async respond(
    id: string,
    requesterId: string,
    isAdmin: boolean,
    dto: RespondRecommendationDto,
  ) {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id },
      include: { shg: true },
    });
    if (!recommendation) {
      throw new NotFoundException(`Recommendation ${id} not found`);
    }
    if (!isAdmin && recommendation.shg.contactUserId !== requesterId) {
      throw new ForbiddenException(
        'Only the recommended SHG or an admin can respond to this recommendation',
      );
    }

    return this.prisma.recommendation.update({
      where: { id },
      data: { status: dto.status, respondedAt: new Date() },
      include: recommendationInclude,
    });
  }

  private async refresh(shgId: string, topK = 10): Promise<void> {
    let candidates: MlCandidate[];
    try {
      const response = await fetch(
        `${this.baseUrl}/matching/candidates?shg_id=${shgId}&top_k=${topK}`,
      );
      if (!response.ok) {
        this.logger.error(
          `ml-services /matching/candidates returned ${response.status}`,
        );
        throw new ServiceUnavailableException(
          'Recommendation engine returned an error — please try again shortly',
        );
      }
      const body = (await response.json()) as { candidates: MlCandidate[] };
      candidates = body.candidates;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(
        `ml-services /matching/candidates unreachable: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Recommendation engine is temporarily unavailable — please try again shortly',
      );
    }

    for (const candidate of candidates) {
      // Any existing recommendation for this (shg, buyer) pair — PENDING
      // ones get their scores refreshed in place; ACCEPTED/REJECTED/EXPIRED
      // ones are left alone (a real historical decision, not something a
      // later recompute should overwrite) *and* must not be recreated —
      // checking only `status: 'PENDING'` here would find no match for an
      // already-decided pair and wrongly create a duplicate PENDING row
      // for a buyer who already has a real decision on record.
      const existing = await this.prisma.recommendation.findFirst({
        where: { shgId, buyerId: candidate.buyer_id },
      });
      if (existing && existing.status !== 'PENDING') {
        continue;
      }

      const data = {
        productId: candidate.product_id,
        matchScore: candidate.match_score,
        expectedDemand: candidate.expected_demand,
        reasons: {
          components: candidate.components,
          templates: candidate.reasons,
        },
      };

      if (existing) {
        await this.prisma.recommendation.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.recommendation.create({
          data: { shgId, buyerId: candidate.buyer_id, ...data },
        });
      }
    }
  }

  private async requireShgAccess(
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
        "Only the SHG's own contact or an admin can view its recommendations",
      );
    }
    return shg;
  }
}
