import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userWithRoles = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: { userRoles: { include: { role: true } } },
});

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists users visible under the caller's RequestScope (see ScopeGuard). */
  async findAllInScope(scope: RequestScope) {
    const where: Prisma.UserWhereInput =
      scope.kind === 'global'
        ? {}
        : scope.kind === 'district'
          ? { userRoles: { some: { districtId: { in: scope.districtIds } } } }
          : scope.kind === 'ulb'
            ? { userRoles: { some: { ulbId: { in: scope.ulbIds } } } }
            : { id: scope.userId };

    return this.prisma.user.findMany({
      where,
      include: userWithRoles.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRoles.include,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(
        `A user with phone ${dto.phone} already exists`,
      );
    }
    return this.prisma.user.create({
      data: dto,
      include: userWithRoles.include,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      include: userWithRoles.include,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
  }

  async assignRole(userId: string, dto: AssignRoleDto) {
    await this.findOne(userId);

    if (dto.role === 'DISTRICT_OFFICIAL' && !dto.districtId) {
      throw new BadRequestException(
        'districtId is required to assign the DISTRICT_OFFICIAL role',
      );
    }
    if (dto.role === 'ULB_OFFICIAL' && (!dto.districtId || !dto.ulbId)) {
      throw new BadRequestException(
        'districtId and ulbId are required to assign the ULB_OFFICIAL role',
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!role) {
      throw new NotFoundException(
        `Role ${dto.role} is not seeded — run the database seed script`,
      );
    }

    return this.prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        districtId: dto.districtId,
        ulbId: dto.ulbId,
      },
      include: { role: true },
    });
  }

  async removeRole(userId: string, userRoleId: string): Promise<void> {
    const userRole = await this.prisma.userRole.findUnique({
      where: { id: userRoleId },
    });
    if (!userRole || userRole.userId !== userId) {
      throw new NotFoundException(
        `Role assignment ${userRoleId} not found for user ${userId}`,
      );
    }
    await this.prisma.userRole.delete({ where: { id: userRoleId } });
  }
}
