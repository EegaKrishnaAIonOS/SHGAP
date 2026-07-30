import { ApiProperty } from '@nestjs/swagger';
import { ConsentPurpose } from '@shgap/database';
import { IsIn } from 'class-validator';

export const CONSENT_PURPOSES: ConsentPurpose[] = [
  'PRODUCT_REGISTRATION',
  'VOICE_ASSISTANT_RECORDING',
  'MARKETING_NOTIFICATIONS',
  'DATA_SHARING_WITH_BUYERS',
  'ANALYTICS',
];

export class GrantConsentDto {
  @ApiProperty({ enum: CONSENT_PURPOSES })
  @IsIn(CONSENT_PURPOSES)
  purpose: ConsentPurpose;
}
