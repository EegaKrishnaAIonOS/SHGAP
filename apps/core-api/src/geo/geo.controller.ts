import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReverseGeocodeQueryDto } from './dto/reverse-geocode-query.dto';
import {
  ReverseGeocodeResult,
  ReverseGeocodeService,
} from './reverse-geocode.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly reverseGeocodeService: ReverseGeocodeService) {}

  @Get('reverse')
  @ApiOperation({
    summary:
      'Best-effort reverse geocode a lat/lng to one of the pilot districts',
    description:
      'A suggestion only — the caller (e.g. registration form) should let the user confirm or override it. Returns nulls if the point is outside the pilot districts or Nominatim is unreachable.',
  })
  reverse(
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<ReverseGeocodeResult> {
    return this.reverseGeocodeService.reverse(query);
  }
}
