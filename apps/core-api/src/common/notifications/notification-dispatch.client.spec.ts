import { NotificationDispatchClient } from './notification-dispatch.client';

describe('NotificationDispatchClient', () => {
  let client: NotificationDispatchClient;

  beforeEach(() => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://notify:3001'),
    };
    client = new NotificationDispatchClient(config as any);
    global.fetch = jest.fn();
  });

  it('dispatches the event with its context and returns true on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    const delivered = await client.dispatch(
      'user-1',
      'TENDER_OPPORTUNITY' as any,
      {
        tenderTitle: 'Supply of pickles',
        deadline: '2026-09-30',
      },
    );

    expect(delivered).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://notify:3001/notifications/dispatch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-1',
          event: 'TENDER_OPPORTUNITY',
          context: { tenderTitle: 'Supply of pickles', deadline: '2026-09-30' },
        }),
      }),
    );
  });

  it('returns false (never throws) when notification-service rejects the dispatch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(
      client.dispatch('user-1', 'TENDER_OPPORTUNITY' as any, {}),
    ).resolves.toBe(false);
  });

  it('returns false (never throws) when notification-service is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );

    await expect(
      client.dispatch('user-1', 'TENDER_OPPORTUNITY' as any, {}),
    ).resolves.toBe(false);
  });
});
