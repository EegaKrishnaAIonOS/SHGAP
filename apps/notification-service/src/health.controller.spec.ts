import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let prisma: { $queryRaw: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    controller = new HealthController(prisma as any);
  });

  it('check() is a plain liveness probe', () => {
    const result = controller.check();
    expect(result).toEqual({ status: 'ok', service: 'notification-service' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  describe('ready', () => {
    it('reports ready when the database responds', async () => {
      const result = await controller.ready();
      expect(result).toEqual({ status: 'ok', checks: { database: true } });
    });

    it('throws 503 when the database check fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      await expect(controller.ready()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
