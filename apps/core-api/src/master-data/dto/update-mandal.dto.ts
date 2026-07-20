import { PartialType } from '@nestjs/swagger';
import { CreateMandalDto } from './create-mandal.dto';

export class UpdateMandalDto extends PartialType(CreateMandalDto) {}
