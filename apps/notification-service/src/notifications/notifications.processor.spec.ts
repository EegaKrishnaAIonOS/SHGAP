import {
  NotificationChannel,
  NotificationEvent,
  NotificationStatus,
  PreferredLanguage,
} from '@shgap/database';
import { Job } from 'bullmq';
import { NotificationsProcessor } from './notifications.processor';

function makeJob(notificationId: string, overrides: Partial<Job> = {}): Job {
  return {
    data: { notificationId },
    opts: { attempts: 3 },
    attemptsMade: 1,
    ...overrides,
  } as unknown as Job;
}

describe('NotificationsProcessor', () => {
  let prisma: any;
  let templateService: any;
  let smsProvider: any;
  let whatsappProvider: any;
  let voiceProvider: any;
  let emailProvider: any;
  let processor: NotificationsProcessor;

  const baseNotification = {
    id: 'notif-1',
    event: NotificationEvent.OTP,
    channel: NotificationChannel.SMS,
    payload: { otp: '123456', expiresInMinutes: '10' },
    user: {
      phone: '9876543210',
      email: 'member@example.com',
      preferredLanguage: PreferredLanguage.ENGLISH,
    },
  };

  beforeEach(() => {
    prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue(baseNotification),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    templateService = {
      render: jest.fn().mockReturnValue({ renderedText: 'hi' }),
    };
    smsProvider = {
      send: jest.fn().mockResolvedValue({ providerMessageId: 'sms-123' }),
    };
    whatsappProvider = {
      send: jest.fn().mockResolvedValue({ providerMessageId: 'wa-123' }),
    };
    voiceProvider = {
      send: jest.fn().mockResolvedValue({ providerMessageId: 'voice-123' }),
    };
    emailProvider = {
      send: jest.fn().mockResolvedValue({ providerMessageId: 'email-123' }),
    };

    processor = new NotificationsProcessor(
      prisma,
      templateService,
      smsProvider,
      whatsappProvider,
      voiceProvider,
      emailProvider,
    );
  });

  it('skips silently when the notification row no longer exists', async () => {
    prisma.notification.findUnique.mockResolvedValueOnce(null);
    await expect(processor.process(makeJob('gone'))).resolves.toBeUndefined();
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it("renders via the template service and sends over the notification's channel", async () => {
    await processor.process(makeJob('notif-1'));

    expect(templateService.render).toHaveBeenCalledWith(
      NotificationEvent.OTP,
      NotificationChannel.SMS,
      { otp: '123456', expiresInMinutes: '10' },
      PreferredLanguage.ENGLISH,
    );
    expect(smsProvider.send).toHaveBeenCalledWith('9876543210', {
      renderedText: 'hi',
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        providerMessageId: 'sms-123',
        failureReason: null,
      },
    });
  });

  it('routes WHATSAPP channel notifications to the WhatsApp provider', async () => {
    prisma.notification.findUnique.mockResolvedValueOnce({
      ...baseNotification,
      channel: NotificationChannel.WHATSAPP,
    });
    await processor.process(makeJob('notif-1'));
    expect(whatsappProvider.send).toHaveBeenCalled();
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it("routes EMAIL channel notifications to the email provider using the user's email", async () => {
    prisma.notification.findUnique.mockResolvedValueOnce({
      ...baseNotification,
      channel: NotificationChannel.EMAIL,
    });
    await processor.process(makeJob('notif-1'));
    expect(emailProvider.send).toHaveBeenCalledWith('member@example.com', {
      renderedText: 'hi',
    });
  });

  it('throws (for BullMQ to retry) and records the failure reason when a user has no email on file', async () => {
    prisma.notification.findUnique.mockResolvedValueOnce({
      ...baseNotification,
      channel: NotificationChannel.EMAIL,
      user: { ...baseNotification.user, email: null },
    });
    await expect(processor.process(makeJob('notif-1'))).rejects.toThrow(
      'User has no email address on file',
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { failureReason: 'User has no email address on file' },
    });
  });

  it('re-throws provider errors so BullMQ can retry, recording the failure reason', async () => {
    smsProvider.send.mockRejectedValueOnce(new Error('MSG91 unreachable'));
    await expect(processor.process(makeJob('notif-1'))).rejects.toThrow(
      'MSG91 unreachable',
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { failureReason: 'MSG91 unreachable' },
    });
  });

  describe('onFailed', () => {
    it('does nothing if there are retries remaining', async () => {
      const job = makeJob('notif-1', {
        attemptsMade: 1,
        opts: { attempts: 3 },
      });
      await processor.onFailed(job, new Error('boom'));
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks the notification FAILED once attempts are exhausted', async () => {
      const job = makeJob('notif-1', {
        attemptsMade: 3,
        opts: { attempts: 3 },
      });
      await processor.onFailed(job, new Error('final failure'));
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          status: NotificationStatus.FAILED,
          failureReason: 'final failure',
        },
      });
    });

    it('does nothing when job is undefined', async () => {
      await expect(
        processor.onFailed(undefined, new Error('boom')),
      ).resolves.toBeUndefined();
    });
  });
});
