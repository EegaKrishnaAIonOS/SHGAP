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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import {
  JwtAccessPayload,
  RequestScope,
} from '../common/interfaces/jwt-payload.interface';
import { CreateShgDto } from './dto/create-shg.dto';
import { QueryShgDto } from './dto/query-shg.dto';
import { UpdateShgDto } from './dto/update-shg.dto';
import { ShgsService } from './shgs.service';

@ApiTags('shgs')
@ApiBearerAuth()
@Controller('shgs')
export class ShgsController {
  constructor(private readonly shgsService: ShgsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Register a new SHG for the authenticated user (auto-assigns the SHG role)',
  })
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateShgDto) {
    return this.shgsService.create(user.sub, dto);
  }

  @Get()
  @UseGuards(ScopeGuard)
  @ApiOperation({
    summary:
      "List SHGs visible within the caller's scope, paginated and filterable",
  })
  findAll(@CurrentScope() scope: RequestScope, @Query() query: QueryShgDto) {
    return this.shgsService.findAllInScope(scope, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single SHG by id' })
  findOne(@Param('id') id: string) {
    return this.shgsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an SHG (owner or admin only)' })
  update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateShgDto,
  ) {
    return this.shgsService.update(id, user.sub, isAdmin(user), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an SHG (owner or admin only)' })
  async remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.shgsService.remove(id, user.sub, isAdmin(user));
  }
}

function isAdmin(user: JwtAccessPayload): boolean {
  return user.roleAssignments.some((ra) => ra.role === 'ADMIN');
}
