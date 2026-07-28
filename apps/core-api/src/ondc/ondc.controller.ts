import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { OndcSearchIntent, OndcService } from './ondc.service';

/**
 * ONDC seller-side (BPP) catalogue-publishing readiness (T21/ADR-0030) —
 * `@Public()` like `/health`, since a real Beckn network call comes from
 * another network participant's server, not a user holding this app's JWT;
 * a real deployment would sit this behind network-level mutual signing
 * verification instead of our own auth guard.
 */
@ApiTags('ondc')
@Controller('ondc')
export class OndcController {
  constructor(private readonly ondcService: OndcService) {}

  @Public()
  @Post('on_search')
  @ApiOperation({
    summary:
      'Beckn on_search callback — publishes the platform’s real, available product catalog, signed with Ed25519',
  })
  async onSearch(
    @Body() intent: OndcSearchIntent,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, authorization } =
      await this.ondcService.buildOnSearchResponse(intent);
    res.setHeader('Authorization', authorization);
    return body;
  }

  @Public()
  @Get('readiness')
  @ApiOperation({
    summary:
      'Self-check: real catalog size + a working Ed25519 signature, no live network call',
  })
  readiness() {
    return this.ondcService.readiness();
  }
}
