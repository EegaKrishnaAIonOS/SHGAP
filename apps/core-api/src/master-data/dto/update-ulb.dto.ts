import { PartialType } from '@nestjs/swagger';
import { CreateUlbDto } from './create-ulb.dto';

export class UpdateUlbDto extends PartialType(CreateUlbDto) {}
