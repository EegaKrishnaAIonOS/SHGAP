import {
  buildCatalogProviders,
  ProductForCatalog,
} from './ondc-catalog.builder';

describe('buildCatalogProviders', () => {
  const products: ProductForCatalog[] = [
    {
      id: 'product-1',
      name: 'Mango Pickle (500g jar)',
      description: 'Homemade mango pickle',
      price: 150,
      stock: 40,
      categoryId: 'cat-pickles',
      shgId: 'shg-1',
      shgName: 'Sri Lakshmi Pickles SHG',
      districtName: 'Anantapur',
      lat: 14.6819,
      lng: 77.6006,
    },
    {
      id: 'product-2',
      name: 'Tomato Pickle (500g jar)',
      description: null,
      price: 120,
      stock: 30,
      categoryId: 'cat-pickles',
      shgId: 'shg-1',
      shgName: 'Sri Lakshmi Pickles SHG',
      districtName: 'Anantapur',
      lat: 14.6819,
      lng: 77.6006,
    },
    {
      id: 'product-3',
      name: 'Cotton Bedsheet',
      description: 'Handloom cotton bedsheet',
      price: 900,
      stock: 10,
      categoryId: 'cat-handloom',
      shgId: 'shg-2',
      shgName: 'Krishna Handloom Weavers SHG',
      districtName: 'Krishna',
      lat: null,
      lng: null,
    },
  ];

  it('groups products by SHG into one provider each', () => {
    const providers = buildCatalogProviders(products);
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.id).sort()).toEqual(['shg-1', 'shg-2']);
  });

  it('carries every product of a provider as a real, priced item', () => {
    const providers = buildCatalogProviders(products);
    const shg1 = providers.find((p) => p.id === 'shg-1')!;
    expect(shg1.items).toHaveLength(2);
    expect(shg1.items[0]).toEqual({
      id: 'product-1',
      descriptor: {
        name: 'Mango Pickle (500g jar)',
        short_desc: 'Homemade mango pickle',
      },
      price: { currency: 'INR', value: '150.00' },
      category_id: 'cat-pickles',
      quantity: { available: { count: 40 } },
    });
  });

  it('omits gps when the SHG has no real geo-location on file', () => {
    const providers = buildCatalogProviders(products);
    const shg2 = providers.find((p) => p.id === 'shg-2')!;
    expect(shg2.locations[0].gps).toBeUndefined();
    expect(shg2.locations[0].district).toBe('Krishna');
  });

  it('returns no providers for an empty catalog', () => {
    expect(buildCatalogProviders([])).toEqual([]);
  });
});
