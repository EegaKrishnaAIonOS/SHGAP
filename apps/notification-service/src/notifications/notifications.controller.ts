import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DispatchNotificationDto } from './dto/dispatch-notification.dto';
import {
  DispatchResultItem,
  NotificationsService,
} from './notifications.service';

/**
 * Internal, service-to-service API — not exposed to the frontend (matches
 * ml-services' own endpoints, which have no auth either: trust boundary is
 * the private network the services share, not a bearer token, per this
 * project's established pattern — see ADR-0022).
 */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('dispatch')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Queue a notification for one or more users over their preferred/specified channel — the only real route this service exposes',
  })
  dispatch(
    @Body() dto: DispatchNotificationDto,
  ): Promise<DispatchResultItem[]> {
    return this.notificationsService.dispatch(dto);
  }
}
