import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  let products: { findAllPublic: jest.Mock; findOne: jest.Mock };
  let shgs: { findPublicSummary: jest.Mock };
  let masterData: { categories: jest.Mock; districts: jest.Mock };
  let service: MarketplaceService;

  const productWithShg = {
    id: 'prod-1',
    name: 'Terracotta Diya Set',
    shg: {
      id: 'shg-1',
      name: 'Vizag Bamboo Craft SHG',
      type: 'HANDICRAFTS',
      productionCapacityNote: '~150 units/month',
      district: { name: 'Visakhapatnam' },
      ulb: null,
      mandal: null,
      bankAccountNumber: 'encrypted:1234',
      bankIfsc: 'encrypted:SBIN0001',
      contactUserId: 'user-1',
      isActive: true,
    },
  };

  beforeEach(() => {
    products = {
      findAllPublic: jest.fn().mockResolvedValue({
        items: [productWithShg],
        page: 1,
        pageSize: 100,
        total: 1,
        totalPages: 1,
      }),
      findOne: jest.fn().mockResolvedValue(productWithShg),
    };
    shgs = {
      findPublicSummary: jest.fn().mockResolvedValue({ id: 'shg-1', name: 'Lakshmi SHG' }),
    };
    masterData = {
      categories: jest.fn().mockResolvedValue([{ id: 'cat-1' }]),
      districts: jest.fn().mockResolvedValue([{ id: 'dist-1', name: 'Anantapur' }]),
    };
    service = new MarketplaceService(
      products as any,
      shgs as any,
      masterData as any,
    );
  });

  it('categories() delegates to MasterDataService.categories()', async () => {
    const result = await service.categories();
    expect(masterData.categories).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'cat-1' }]);
  });

  it('districts() delegates to MasterDataService.districts()', async () => {
    const result = await service.districts();
    expect(masterData.districts).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'dist-1', name: 'Anantapur' }]);
  });

  describe('listProducts', () => {
    it('delegates to ProductsService.findAllPublic()', async () => {
      const query = { skip: 0, page: 1, pageSize: 20 } as any;
      await service.listProducts(query);
      expect(products.findAllPublic).toHaveBeenCalledWith(query);
    });

    it("strips the nested SHG's bank/PII fields from every item", async () => {
      const result = await service.listProducts({ skip: 0, page: 1, pageSize: 20 } as any);
      const shg = (result.items[0] as any).shg;
      expect(shg).not.toHaveProperty('bankAccountNumber');
      expect(shg).not.toHaveProperty('bankIfsc');
      expect(shg).not.toHaveProperty('contactUserId');
      expect(shg.name).toBe('Vizag Bamboo Craft SHG');
    });
  });

  describe('getProduct', () => {
    it('delegates to ProductsService.findOne(), the same method the authenticated single-product read uses', async () => {
      await service.getProduct('prod-1');
      expect(products.findOne).toHaveBeenCalledWith('prod-1');
    });

    it("strips the nested SHG's bank/PII fields, since findOne() returns the full authenticated shape", async () => {
      const result = (await service.getProduct('prod-1')) as any;
      expect(result.shg).not.toHaveProperty('bankAccountNumber');
      expect(result.shg).not.toHaveProperty('bankIfsc');
      expect(result.shg).not.toHaveProperty('contactUserId');
    });
  });

  describe('getStorefront', () => {
    it('composes the SHG public summary with its available (sanitized) products, scoped by shgId', async () => {
      const result = await service.getStorefront('shg-1');

      expect(shgs.findPublicSummary).toHaveBeenCalledWith('shg-1');
      expect(products.findAllPublic).toHaveBeenCalledWith(
        expect.objectContaining({ shgId: 'shg-1' }),
      );
      expect(result.shg).toEqual({ id: 'shg-1', name: 'Lakshmi SHG' });
      expect(result.products[0]).not.toHaveProperty('shg.bankAccountNumber');
      expect((result.products[0] as any).shg).not.toHaveProperty('bankAccountNumber');
    });
  });
});