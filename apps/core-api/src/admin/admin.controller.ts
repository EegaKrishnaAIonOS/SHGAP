import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
