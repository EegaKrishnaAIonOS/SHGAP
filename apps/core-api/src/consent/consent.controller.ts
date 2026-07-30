import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseEnumPipe,
  Post,
} from '@nestjs/common';
import { ConsentPurpose } from '@shgap/database';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../common/interfaces/jwt-payload.interface';
import { ConsentService } from './consent.service';
import { GrantConsentDto, CONSENT_PURPOSES } from './dto/grant-consent.dto';
import { PRIVACY_NOTICES } from './privacy-notices';

@ApiTags('consent')
@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Public()
  @Get('notices')
  @ApiOperation({
    summary:
      'Privacy notice text for every consent purpose — readable before logging in, by design',
  })
  notices() {
    return CONSENT_PURPOSES.map((purpose) => ({
      purpose,
      ...PRIVACY_NOTICES[purpose],
    }));
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary: "The caller's own current consent status for every purpose",
  })
  listMine(@CurrentUser() user: JwtAccessPayload) {
    return this.consentService.listCurrent(user.sub);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary:
      'Grant consent for a purpose, tied to the privacy notice version shown',
  })
  grant(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: GrantConsentDto,
    @Ip() ip: string,
  ) {
    return this.consentService.grant(user.sub, dto.purpose, ip);
  }

  @ApiBearerAuth()
  @Post(':purpose/withdraw')
  @ApiOperation({
    summary:
      'Withdraw a previously-granted consent — idempotent, never an error',
  })
  withdraw(
    @CurrentUser() user: JwtAccessPayload,
    @Param('purpose', new ParseEnumPipe(ConsentPurpose))
    purpose: ConsentPurpose,
    @Ip() ip: string,
  ) {
    return this.consentService.withdraw(user.sub, purpose, ip);
  }
}
