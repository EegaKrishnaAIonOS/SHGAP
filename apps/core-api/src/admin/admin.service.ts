import { Injectable } from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';

export interface AdminSummary {
  totalShgs: number;
  activeShgs: number;
  totalProducts: number;
  availableProducts: number;
  totalUsers: number;
}

function shgScopeWhere(scope: RequestScope): Prisma.ShgWhereInput {
  switch (scope.kind) {
    case 'global':
      return {};
    case 'district':
      return { districtId: { in: scope.districtIds } };
    case 'ulb':
      return { ulbId: { in: scope.ulbIds } };
    case 'self':
      return { contactUserId: scope.userId };
  }
}

function productScopeWhere(scope: RequestScope): Prisma.ProductWhereInput {
  switch (scope.kind) {
    case 'global':
      return {};
    case 'district':
      return { shg: { districtId: { in: scope.districtIds } } };
    case 'ulb':
      return { shg: { ulbId: { in: scope.ulbIds } } };
    case 'self':
      return { shg: { contactUserId: scope.userId } };
  }
}

function userScopeWhere(scope: RequestScope): Prisma.UserWhereInput {
  switch (scope.kind) {
    case 'global':
      return {};
    case 'district':
      return { userRoles: { some: { districtId: { in: scope.districtIds } } } };
    case 'ulb':
      return { userRoles: { some: { ulbId: { in: scope.ulbIds } } } };
    case 'self':
      return { id: scope.userId };
  }
}

/**
 * Summary tiles for the admin portal home (T09) — counts scoped the same
 * way the SHG/product/user list endpoints already are, so a district/ULB
 * official sees counts for their own area rather than the whole platform.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(scope: RequestScope): Promise<AdminSummary> {
    const shgWhere = shgScopeWhere(scope);
    const productWhere = productScopeWhere(scope);
    const userWhere = userScopeWhere(scope);

    const [
      totalShgs,
      activeShgs,
      totalProducts,
      availableProducts,
      totalUsers,
    ] = await this.prisma.$transaction([
      this.prisma.shg.count({ where: shgWhere }),
      this.prisma.shg.count({ where: { ...shgWhere, isActive: true } }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.product.count({
        where: { ...productWhere, isAvailable: true },
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);

    return {
      totalShgs,
      activeShgs,
      totalProducts,
      availableProducts,
      totalUsers,
    };
  }
}
