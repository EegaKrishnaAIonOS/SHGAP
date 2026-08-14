import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audited } from '../audit/audited.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { RespondEnquiryDto } from './dto/respond-enquiry.dto';
import { EnquiriesService } from './enquiries.service';

/** RFQ submit (buyer) / respond (SHG) — Phase 2 of the public marketplace.
 * Unlike the Phase 1 `marketplace` module, nothing here is `@Public()`:
 * both submitting and responding require a real login. Any authenticated
 * user can submit/see their own — no `@Roles()` guard, same "auth-only"
 * shape as `ShgsController.create` — since a first-time caller doesn't have
 * the `BUYER` role yet at the moment they submit their first RFQ. */
@ApiTags('enquiries')
@ApiBearerAuth()
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Post()
  @Audited('Enquiry')
  @ApiOperation({
    summary:
      'Submit an RFQ on a product (auto-creates a buyer profile + BUYER role on first use)',
  })
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateEnquiryDto) {
    return this.enquiries.create(user.sub, dto);
  }

  @Get('sent')
  @ApiOperation({ summary: "The caller's own submitted RFQs" })
  listSent(@CurrentUser() user: JwtAccessPayload) {
    return this.enquiries.listSent(user.sub);
  }

  @Get('received')
  @ApiOperation({
    summary: "RFQs received by the caller's SHG(s) (admin sees all)",
  })
  listReceived(@CurrentUser() user: JwtAccessPayload) {
    return this.enquiries.listReceived(user.sub, isAdmin(user));
  }

  @Patch(':id/respond')
  @Audited('Enquiry')
  @ApiOperation({
    summary: 'Respond to an RFQ (owning SHG contact or admin only)',
  })
  respond(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: RespondEnquiryDto,
  ) {
    return this.enquiries.respond(id, user.sub, isAdmin(user), dto);
  }
}

function isAdmin(user: JwtAccessPayload): boolean {
  return user.roleAssignments.some((ra) => ra.role === 'ADMIN');
}