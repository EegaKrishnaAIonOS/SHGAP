import { verifySignature } from './beckn-signing.util';
import { OndcService } from './ondc.service';

describe('OndcService', () => {
  let prisma: any;
  let geo: { getLocation: jest.Mock };
  let config: { get: jest.Mock };
  let service: OndcService;

  const productRow = {
    id: 'product-1',
    name: 'Mango Pickle (500g jar)',
    description: 'Homemade mango pickle',
    price: { toString: () => '150.00' } as unknown as number,
    stock: 40,
    categoryId: 'cat-pickles',
    shgId: 'shg-1',
    shg: { name: 'Sri Lakshmi Pickles SHG', district: { name: 'Anantapur' } },
  };

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn().mockResolvedValue([productRow]) },
    };
    geo = {
      getLocation: jest.fn().mockResolvedValue({ lat: 14.6819, lng: 77.6006 }),
    };
    config = { get: jest.fn((key: string, fallback: string) => fallback) };
    service = new OndcService(prisma, geo as any, config as any);
  });

  it('only publishes available, in-stock products', async () => {
    await service.buildOnSearchResponse();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isAvailable: true, stock: { gt: 0 } },
      }),
    );
  });

  it('builds a real Beckn on_search context and catalog from real product data', async () => {
    const { body } = await service.buildOnSearchResponse({
      bapId: 'buyer-app.example',
      bapUri: 'https://buyer-app.example',
    });

    expect(body.context.action).toBe('on_search');
    expect(body.context.bap_id).toBe('buyer-app.example');
    const providers = body.message.catalog['bpp/providers'];
    expect(providers).toHaveLength(1);
    expect(providers[0].items[0].descriptor.name).toBe(
      'Mango Pickle (500g jar)',
    );
  });

  it('signs the response with a signature that verifies against the same keypair', async () => {
    const { body, authorization } = await service.buildOnSearchResponse();
    const keyPair = (service as unknown as { keyPair: { publicKey: unknown } })
      .keyPair;

    const created = Number(/created="(\d+)"/.exec(authorization)![1]);
    const expires = Number(/expires="(\d+)"/.exec(authorization)![1]);
    const signatureBase64 = /signature="([^"]+)"/.exec(authorization)![1];

    const { digestBody } = await import('./beckn-signing.util');
    const verified = verifySignature({
      publicKey: keyPair.publicKey as never,
      created,
      expires,
      digestBase64: digestBody(JSON.stringify(body)),
      signatureBase64,
    });
    expect(verified).toBe(true);
  });

  describe('readiness', () => {
    it('reports real catalog counts and that no ONDC network registration exists', async () => {
      const result = await service.readiness();
      expect(result.publishableProviderCount).toBe(1);
      expect(result.publishableItemCount).toBe(1);
      expect(result.registeredWithOndcNetwork).toBe(false);
      expect(result.signingAlgorithm).toBe('ed25519');
    });
  });
});
