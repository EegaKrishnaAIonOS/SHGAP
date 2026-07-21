import { NotificationServiceProvider } from './notification-service.provider';

describe('NotificationServiceProvider', () => {
  let provider: NotificationServiceProvider;

  beforeEach(() => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://notify:3001'),
    };
    provider = new NotificationServiceProvider(config as any);
    global.fetch = jest.fn();
  });

  it('dispatches an OTP event with minutes derived from the configured TTL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    await provider.sendOtp('user-1', '9876543210', '123456', 300);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://notify:3001/notifications/dispatch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-1',
          event: 'OTP',
          context: { otp: '123456', expiresInMinutes: '5' },
        }),
      }),
    );
  });

  it('throws when notification-service rejects the dispatch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(
      provider.sendOtp('user-1', '9876543210', '123456', 300),
    ).rejects.toThrow(
      'notification-service rejected OTP dispatch for 9876543210',
    );
  });
});
