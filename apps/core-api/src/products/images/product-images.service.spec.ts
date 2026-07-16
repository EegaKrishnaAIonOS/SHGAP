import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductImagesService } from './product-images.service';

jest.mock('sharp', () => {
  const chain = {
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized')),
  };
  // TS compiles `import sharp from 'sharp'` to expect a `.default` export
  // under esModuleInterop, so the mock must provide one too.
  return { __esModule: true, default: jest.fn(() => chain) };
});

describe('ProductImagesService', () => {
  let prisma: any;
  let avScan: { assertClean: jest.Mock };
  let minio: { uploadBuffer: jest.Mock };
  let service: ProductImagesService;

  beforeEach(() => {
    prisma = {
      productImage: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'img-1' }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'img-1', productId: 'prod-1' }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    avScan = { assertClean: jest.fn().mockResolvedValue(undefined) };
    minio = {
      uploadBuffer: jest
        .fn()
        .mockResolvedValue('http://minio/products/prod-1/asset.webp'),
    };
    service = new ProductImagesService(prisma, avScan as any, minio as any);
  });

  it('rejects unsupported mime types before scanning or uploading', async () => {
    await expect(
      service.upload('prod-1', {
        buffer: Buffer.from('x'),
        mimetype: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(avScan.assertClean).not.toHaveBeenCalled();
    expect(minio.uploadBuffer).not.toHaveBeenCalled();
  });

  it('scans the buffer and rejects if ClamAV flags it as infected', async () => {
    avScan.assertClean.mockRejectedValueOnce(
      new UnprocessableEntityException('File failed the virus scan'),
    );
    await expect(
      service.upload('prod-1', {
        buffer: Buffer.from('x'),
        mimetype: 'image/jpeg',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(minio.uploadBuffer).not.toHaveBeenCalled();
  });

  it('resizes, uploads both the main image and thumbnail, and marks the first image as primary', async () => {
    const result = await service.upload('prod-1', {
      buffer: Buffer.from('x'),
      mimetype: 'image/jpeg',
    });

    expect(avScan.assertClean).toHaveBeenCalled();
    expect(minio.uploadBuffer).toHaveBeenCalledTimes(2);
    expect(prisma.productImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrimary: true }),
      }),
    );
    expect(result).toEqual({ id: 'img-1' });
  });

  it('does not mark subsequent images as primary', async () => {
    prisma.productImage.count.mockResolvedValueOnce(1);
    await service.upload('prod-1', {
      buffer: Buffer.from('x'),
      mimetype: 'image/png',
    });
    expect(prisma.productImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrimary: false }),
      }),
    );
  });

  it('remove() is a no-op when the image does not belong to the given product', async () => {
    prisma.productImage.findFirst.mockResolvedValueOnce(null);
    await service.remove('prod-1', 'img-missing');
    expect(prisma.productImage.delete).not.toHaveBeenCalled();
  });
});
