import { ConfigService } from '@nestjs/config';
import { WhatsappBusinessProvider } from './whatsapp-business.provider';

function makeConfig(): ConfigService {
  const values: Record<string, string> = {
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '1234567890',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('WhatsappBusinessProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends a templated message to the Cloud API and returns the message id', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.123' }] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const provider = new WhatsappBusinessProvider(makeConfig());
    const result = await provider.send('9876543210', {
      templateName: 'buyer_enquiry_v1',
      languageCode: 'en',
      params: ['ABC Retailers', 'Pickle'],
    });

    expect(result).toEqual({ providerMessageId: 'wamid.123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/1234567890/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'template',
      template: {
        name: 'buyer_enquiry_v1',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'ABC Retailers' },
              { type: 'text', text: 'Pickle' },
            ],
          },
        ],
      },
    });
  });

  it('throws with the Graph API error message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () =>
        Promise.resolve({ error: { message: 'Template not approved' } }),
    }) as unknown as typeof fetch;

    const provider = new WhatsappBusinessProvider(makeConfig());
    await expect(
      provider.send('9876543210', {
        templateName: 'x',
        languageCode: 'en',
        params: [],
      }),
    ).rejects.toThrow('Template not approved');
  });
});
