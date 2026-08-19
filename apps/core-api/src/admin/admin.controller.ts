import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('summary')
  @UseGuards(ScopeGuard, RolesGuard)
  @Roles('ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'ULB_OFFICIAL')
  @ApiOperation({
    summary:
      "SHG/product/user counts for the admin home, scoped to the caller's district/ULB (or global for admin/state)",
  })
  summary(@CurrentScope() scope: RequestScope) {
    return this.adminService.summary(scope);
  }

  @Get('users/pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'List self-registered SHG/Distributor accounts awaiting approval (T25)',
  })
  listPendingUsers() {
    return this.adminService.listPendingUsers();
  }

  @Patch('users/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve a pending SHG/Distributor registration' })
  approveUser(@Param('id') id: string) {
    return this.adminService.approveUser(id);
  }

  @Patch('users/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reject a pending SHG/Distributor registration' })
  rejectUser(@Param('id') id: string) {
    return this.adminService.rejectUser(id);
  }
}
