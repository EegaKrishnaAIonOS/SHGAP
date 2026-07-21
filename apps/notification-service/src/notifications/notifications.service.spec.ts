import {
  ConsentPurpose,
  NotificationChannel,
  NotificationEvent,
  NotificationStatus,
  PreferredLanguage,
} from '@shgap/database';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TemplateService } from './templates/template.service';

describe('NotificationsService', () => {
  let prisma: any;
  let queue: any;
  let service: NotificationsService;

  const activeUser = {
    id: 'user-1',
    phone: '9876543210',
    email: 'member@example.com',
    preferredLanguage: PreferredLanguage.ENGLISH,
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(activeUser) },
      consent: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'notif-1', ...data }),
          ),
      },
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(prisma, new TemplateService(), queue);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.dispatch({
        userId: 'missing',
        event: NotificationEvent.OTP,
        context: {},
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('dispatches OTP over SMS only (default routing), queueing one job', async () => {
    const results = await service.dispatch({
      userId: 'user-1',
      event: NotificationEvent.OTP,
      context: { otp: '123456', expiresInMinutes: '10' },
    });

    expect(results).toEqual([
      {
        notificationId: 'notif-1',
        channel: NotificationChannel.SMS,
        status: NotificationStatus.QUEUED,
      },
    ]);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'send',
      { notificationId: 'notif-1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('dispatches a buyer enquiry over both SMS and WhatsApp (transactional, no consent gate)', async () => {
    const results = await service.dispatch({
      userId: 'user-1',
      event: NotificationEvent.BUYER_ENQUIRY,
      context: { buyerName: 'ABC Retailers', productName: 'Pickle' },
    });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.channel)).toEqual([
      NotificationChannel.SMS,
      NotificationChannel.WHATSAPP,
    ]);
    expect(prisma.consent.findFirst).not.toHaveBeenCalled();
  });

  it('respects an explicit channel override over the default routing', async () => {
    const results = await service.dispatch({
      userId: 'user-1',
      event: NotificationEvent.BUYER_ENQUIRY,
      context: { buyerName: 'ABC Retailers', productName: 'Pickle' },
      channels: [NotificationChannel.WHATSAPP],
    });

    expect(results).toHaveLength(1);
    expect(results[0].channel).toBe(NotificationChannel.WHATSAPP);
  });

  it('rejects when no channels are configured for an event and none were overridden', async () => {
    // Simulate an event with no default routing by overriding with an empty array.
    await expect(
      service.dispatch({
        userId: 'user-1',
        event: NotificationEvent.OTP,
        context: {},
        channels: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('marketing consent gating', () => {
    it('blocks a non-transactional event when no consent record exists, logging it as FAILED', async () => {
      const results = await service.dispatch({
        userId: 'user-1',
        event: NotificationEvent.PRICE_CHANGE,
        context: { productName: 'Pickle', newPrice: 'Rs 100' },
      });

      expect(prisma.consent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            purpose: ConsentPurpose.MARKETING_NOTIFICATIONS,
          },
        }),
      );
      for (const result of results) {
        expect(result.status).toBe(NotificationStatus.FAILED);
      }
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('blocks when the latest consent record was withdrawn', async () => {
      prisma.consent.findFirst.mockResolvedValueOnce({
        granted: true,
        withdrawnAt: new Date(),
      });
      const results = await service.dispatch({
        userId: 'user-1',
        event: NotificationEvent.PRICE_CHANGE,
        context: { productName: 'Pickle', newPrice: 'Rs 100' },
      });
      expect(results.every((r) => r.status === NotificationStatus.FAILED)).toBe(
        true,
      );
    });

    it('proceeds when a granted, non-withdrawn consent record exists', async () => {
      prisma.consent.findFirst.mockResolvedValueOnce({
        granted: true,
        withdrawnAt: null,
      });
      const results = await service.dispatch({
        userId: 'user-1',
        event: NotificationEvent.PRICE_CHANGE,
        context: { productName: 'Pickle', newPrice: 'Rs 100' },
      });
      expect(results.every((r) => r.status === NotificationStatus.QUEUED)).toBe(
        true,
      );
      expect(queue.add).toHaveBeenCalledTimes(results.length);
    });
  });
});
