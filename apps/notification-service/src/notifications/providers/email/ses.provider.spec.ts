import { ConfigService } from '@nestjs/config';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-ses', () => {
  const actual = jest.requireActual('@aws-sdk/client-ses');
  return {
    ...actual,
    SESClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

// Imported after the mock so the class picks up the mocked SESClient.
import { SesProvider } from './ses.provider';

function makeConfig(): ConfigService {
  const values: Record<string, string> = {
    AWS_SES_REGION: 'ap-south-1',
    AWS_ACCESS_KEY_ID: 'AKIA_TEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
    SES_FROM_EMAIL: 'noreply@shgap.example',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('SesProvider', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('sends an email via SES and returns the message id', async () => {
    mockSend.mockResolvedValue({ MessageId: 'ses-msg-1' });

    const provider = new SesProvider(makeConfig());
    const result = await provider.send('buyer@example.com', {
      subject: 'Price change alert',
      bodyText: 'The price changed.',
    });

    expect(result).toEqual({ providerMessageId: 'ses-msg-1' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual({
      Source: 'noreply@shgap.example',
      Destination: { ToAddresses: ['buyer@example.com'] },
      Message: {
        Subject: { Data: 'Price change alert', Charset: 'UTF-8' },
        Body: { Text: { Data: 'The price changed.', Charset: 'UTF-8' } },
      },
    });
  });

  it('propagates SES errors so BullMQ can retry', async () => {
    mockSend.mockRejectedValue(new Error('SES throttled'));
    const provider = new SesProvider(makeConfig());
    await expect(
      provider.send('buyer@example.com', { subject: 'x', bodyText: 'y' }),
    ).rejects.toThrow('SES throttled');
  });
});
