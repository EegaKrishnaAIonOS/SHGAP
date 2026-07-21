import { ConfigService } from '@nestjs/config';
import { ExotelProvider } from './exotel.provider';

function makeConfig(): ConfigService {
  const values: Record<string, string> = {
    EXOTEL_ACCOUNT_SID: 'sid-1',
    EXOTEL_API_KEY: 'key-1',
    EXOTEL_API_TOKEN: 'token-1',
    EXOTEL_CALLER_ID: '08012345678',
    EXOTEL_VOICE_APPLET_URL: 'https://applets.example.com/say',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('ExotelProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initiates a call via the Connect API and returns the call sid', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Call: { Sid: 'call-123' } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new ExotelProvider(makeConfig());
    const result = await provider.send('9876543210', {
      ttsText: 'New tender opportunity',
    });

    expect(result).toEqual({ providerMessageId: 'call-123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.exotel.com/v1/Accounts/sid-1/Calls/connect.json',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, options] = mockFetch.mock.calls[0];
    const params = new URLSearchParams(options.body as string);
    expect(params.get('From')).toBe('919876543210');
    expect(params.get('CallerId')).toBe('08012345678');
    expect(params.get('Url')).toContain(
      encodeURIComponent('New tender opportunity'),
    );
  });

  it('throws with the Exotel error message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      json: () =>
        Promise.resolve({ RestException: { Message: 'Invalid caller id' } }),
    }) as unknown as typeof fetch;

    const provider = new ExotelProvider(makeConfig());
    await expect(provider.send('9876543210', { ttsText: 'x' })).rejects.toThrow(
      'Invalid caller id',
    );
  });
});
