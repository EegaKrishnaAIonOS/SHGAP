import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { AvScanService } from '../../storage/av-scan.service';
import { MinioService } from '../../storage/minio.service';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAIN_MAX_WIDTH = 1600;
const THUMB_WIDTH = 320;

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avScan: AvScanService,
    private readonly minio: MinioService,
  ) {}

  async upload(productId: string, file: { buffer: Buffer; mimetype: string }) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}" — allowed: jpeg, png, webp`,
      );
    }

    await this.avScan.assertClean(file.buffer);

    const [mainBuffer, thumbBuffer] = await Promise.all([
      sharp(file.buffer)
        .resize({ width: MAIN_MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
      sharp(file.buffer)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer(),
    ]);

    const assetId = crypto.randomUUID();
    const [url, thumbnailUrl] = await Promise.all([
      this.minio.uploadBuffer(
        `products/${productId}/${assetId}.webp`,
        mainBuffer,
        'image/webp',
      ),
      this.minio.uploadBuffer(
        `products/${productId}/${assetId}-thumb.webp`,
        thumbBuffer,
        'image/webp',
      ),
    ]);

    const isFirstImage =
      (await this.prisma.productImage.count({ where: { productId } })) === 0;

    return this.prisma.productImage.create({
      data: { productId, url, thumbnailUrl, isPrimary: isFirstImage },
    });
  }

  async remove(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) return;
    await this.prisma.productImage.delete({ where: { id: imageId } });
  }
}
