import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  let prisma: any;
  let service: RecommendationsService;

  const shgRow = { id: 'shg-1', contactUserId: 'user-1' };
  const recommendationRow = {
    id: 'rec-1',
    shgId: 'shg-1',
    buyerId: 'buyer-1',
    status: 'PENDING',
    shg: shgRow,
  };
  const mlCandidate = {
    buyer_id: 'buyer-1',
    product_id: 'prod-1',
    match_score: 0.82,
    expected_demand: 15.5,
    reasons: ['Matches Pickles category'],
    components: { content_similarity: 0.7, category_interest: 1.0 },
  };

  beforeEach(() => {
    prisma = {
      shg: { findUnique: jest.fn().mockResolvedValue(shgRow) },
      recommendation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([recommendationRow]),
        findUnique: jest.fn().mockResolvedValue(recommendationRow),
        create: jest.fn().mockResolvedValue(recommendationRow),
        update: jest.fn().mockResolvedValue(recommendationRow),
      },
    };
    const config = { getOrThrow: jest.fn().mockReturnValue('http://ml:8001') };
    service = new RecommendationsService(config as any, prisma);
    global.fetch = jest.fn();
  });

  describe('getForShg', () => {
    it('rejects a non-owner, non-admin caller', async () => {
      await expect(
        service.getForShg('shg-1', 'someone-else', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing SHG', async () => {
      prisma.shg.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.getForShg('missing', 'user-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an admin to view any SHG', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] }),
      });
      await expect(
        service.getForShg('shg-1', 'someone-else', true),
      ).resolves.toBeDefined();
    });

    it('fetches candidates from ml-services and creates a new recommendation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [mlCandidate] }),
      });

      await service.getForShg('shg-1', 'user-1', false);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://ml:8001/matching/candidates?shg_id=shg-1&top_k=10',
      );
      expect(prisma.recommendation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shgId: 'shg-1',
          buyerId: 'buyer-1',
          productId: 'prod-1',
          matchScore: 0.82,
          expectedDemand: 15.5,
          reasons: {
            components: mlCandidate.components,
            templates: mlCandidate.reasons,
          },
        }),
      });
    });

    it('updates an existing PENDING recommendation instead of creating a duplicate', async () => {
      prisma.recommendation.findFirst.mockResolvedValueOnce({
        id: 'existing-rec',
        status: 'PENDING',
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [mlCandidate] }),
      });

      await service.getForShg('shg-1', 'user-1', false);

      expect(prisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-rec' } }),
      );
      expect(prisma.recommendation.create).not.toHaveBeenCalled();
    });

    it('does not create or update a duplicate when the buyer already has an ACCEPTED/REJECTED recommendation', async () => {
      prisma.recommendation.findFirst.mockResolvedValueOnce({
        id: 'already-decided',
        status: 'ACCEPTED',
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [mlCandidate] }),
      });

      await service.getForShg('shg-1', 'user-1', false);

      expect(prisma.recommendation.create).not.toHaveBeenCalled();
      expect(prisma.recommendation.update).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when ml-services is unreachable', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('ECONNREFUSED'),
      );
      await expect(service.getForShg('shg-1', 'user-1', false)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when ml-services returns a non-OK status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      await expect(service.getForShg('shg-1', 'user-1', false)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('respond', () => {
    it('allows the recommended SHG to respond', async () => {
      await expect(
        service.respond('rec-1', 'user-1', false, { status: 'ACCEPTED' }),
      ).resolves.toBeDefined();
      expect(prisma.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
    });

    it('allows an admin to respond on behalf of the SHG', async () => {
      await expect(
        service.respond('rec-1', 'someone-else', true, { status: 'REJECTED' }),
      ).resolves.toBeDefined();
    });

    it('rejects a non-owner, non-admin responder', async () => {
      await expect(
        service.respond('rec-1', 'someone-else', false, { status: 'ACCEPTED' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing recommendation', async () => {
      prisma.recommendation.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.respond('missing', 'user-1', false, { status: 'ACCEPTED' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
