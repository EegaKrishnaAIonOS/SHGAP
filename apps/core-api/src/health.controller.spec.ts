import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let prisma: { $queryRaw: jest.Mock };
  let redis: { ping: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    redis = { ping: jest.fn().mockResolvedValue('PONG') };
    controller = new HealthController(prisma as any, redis as any);
  });

  describe('check', () => {
    it('is a plain liveness probe with no dependency checks', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('core-api');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(redis.ping).not.toHaveBeenCalled();
    });
  });

  describe('ready', () => {
    it('reports ready when both the database and Redis respond', async () => {
      const result = await controller.ready();
      expect(result).toEqual({
        status: 'ok',
        checks: { database: true, redis: true },
      });
    });

    it('throws 503 when the database check fails, without ever ok=true', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(controller.ready()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws 503 when Redis does not reply PONG', async () => {
      redis.ping.mockResolvedValue('WRONG');

      await expect(controller.ready()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('still reports the individual per-dependency results on failure', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      try {
        await controller.ready();
        fail('expected ready() to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const response = (err as ServiceUnavailableException).getResponse() as {
          status: string;
          checks: Record<string, boolean>;
        };
        expect(response.checks).toEqual({ database: false, redis: true });
      }
    });
  });
});
