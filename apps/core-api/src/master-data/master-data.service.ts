import { Injectable } from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';

const categoryWithChildren = Prisma.validator<Prisma.CategoryDefaultArgs>()({
  include: { children: { orderBy: { name: 'asc' } } },
});

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  districts() {
    return this.prisma.district.findMany({ orderBy: { name: 'asc' } });
  }

  ulbsByDistrict(districtId: string) {
    return this.prisma.ulb.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
    });
  }

  mandalsByDistrict(districtId: string) {
    return this.prisma.mandal.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
    });
  }

  /** Top-level categories with their children nested (a 2-level taxonomy — see T02 seed). */
  categories() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: categoryWithChildren.include,
      orderBy: { name: 'asc' },
    });
  }
}
