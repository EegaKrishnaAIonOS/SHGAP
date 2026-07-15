import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ScopeGuard } from '../common/guards/scope.guard';
import {
  JwtAccessPayload,
  RequestScope,
} from '../common/interfaces/jwt-payload.interface';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: "Get the authenticated user's own profile" })
  me(@CurrentUser() user: JwtAccessPayload) {
    return this.usersService.findOne(user.sub);
  }

  @Get()
  @UseGuards(ScopeGuard, RolesGuard)
  @Roles('ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'ULB_OFFICIAL')
  @ApiOperation({
    summary: "List users visible within the caller's district/ULB scope",
  })
  findAll(@CurrentScope() scope: RequestScope) {
    return this.usersService.findAllInScope(scope);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'ULB_OFFICIAL')
  @ApiOperation({ summary: 'Get a single user by id' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Create a user directly (e.g. provisioning an official account)',
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(id);
  }

  @Post(':id/roles')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Assign a role (optionally scoped to a district/ULB) to a user',
  })
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto);
  }

  @Delete(':id/roles/:userRoleId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role assignment from a user' })
  async removeRole(
    @Param('id') id: string,
    @Param('userRoleId') userRoleId: string,
  ): Promise<void> {
    await this.usersService.removeRole(id, userRoleId);
  }
}
