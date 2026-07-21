import { ConfigService } from '@nestjs/config';
import { Msg91Provider } from './msg91.provider';

function makeConfig(): ConfigService {
  const values: Record<string, string> = {
    MSG91_AUTH_KEY: 'test-auth-key',
    MSG91_SENDER_ID: 'SHGAPP',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('Msg91Provider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends the template id, sender and mobile-prefixed number, returning the request id', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ type: 'success', request_id: 'req-1' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new Msg91Provider(makeConfig());
    const result = await provider.send('9876543210', {
      templateId: 'OTP_LOGIN_V1',
      variables: { OTP: '123456' },
      renderedText: 'Your OTP is 123456',
    });

    expect(result).toEqual({ providerMessageId: 'req-1' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/flow/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authkey: 'test-auth-key' }),
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      template_id: 'OTP_LOGIN_V1',
      sender: 'SHGAPP',
      short_url: '0',
      recipients: [{ mobiles: '919876543210', OTP: '123456' }],
    });
  });

  it('throws when MSG91 responds with an error type', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ type: 'error', message: 'Invalid template' }),
    }) as unknown as typeof fetch;

    const provider = new Msg91Provider(makeConfig());
    await expect(
      provider.send('9876543210', {
        templateId: 'X',
        variables: {},
        renderedText: 'x',
      }),
    ).rejects.toThrow('Invalid template');
  });

  it('throws when the HTTP response itself is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;

    const provider = new Msg91Provider(makeConfig());
    await expect(
      provider.send('9876543210', {
        templateId: 'X',
        variables: {},
        renderedText: 'x',
      }),
    ).rejects.toThrow('Unauthorized');
  });
});
