import { Global, Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { ReverseGeocodeService } from './reverse-geocode.service';

@Global()
@Module({
  controllers: [GeoController],
  providers: [GeoService, ReverseGeocodeService],
  exports: [GeoService, ReverseGeocodeService],
})
export class GeoModule {}
