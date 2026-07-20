import { PartialType } from '@nestjs/swagger';
import { CreateFestivalCalendarDto } from './create-festival-calendar.dto';

export class UpdateFestivalCalendarDto extends PartialType(
  CreateFestivalCalendarDto,
) {}
