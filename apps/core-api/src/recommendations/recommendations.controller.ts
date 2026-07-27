import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../common/interfaces/jwt-payload.interface';
import { RespondRecommendationDto } from './dto/respond-recommendation.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get(':shgId')
  @ApiOperation({
    summary:
      "Get an SHG's buyer recommendations with match scores and reasons (owner or admin only) — recomputed fresh from ml-services on every call",
  })
  getForShg(
    @CurrentUser() user: JwtAccessPayload,
    @Param('shgId') shgId: string,
  ) {
    return this.recommendationsService.getForShg(
      shgId,
      user.sub,
      isAdmin(user),
    );
  }

  @Patch(':id/respond')
  @ApiOperation({
    summary:
      'Accept or reject a recommendation (the recommended SHG or admin only)',
  })
  respond(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: RespondRecommendationDto,
  ) {
    return this.recommendationsService.respond(
      id,
      user.sub,
      isAdmin(user),
      dto,
    );
  }
}

function isAdmin(user: JwtAccessPayload): boolean {
  return user.roleAssignments.some((ra) => ra.role === 'ADMIN');
}
