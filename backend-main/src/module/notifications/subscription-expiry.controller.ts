import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsIdentityGuard } from './notifications-identity.guard';
import { SubscriptionExpiryRateGuard } from './subscription-expiry-rate.guard';
import {
  ExpiryIdentity,
  SubscriptionExpiryService,
} from './subscription-expiry.service';

@Controller('notifications/subscriptions')
@UseGuards(NotificationsIdentityGuard, SubscriptionExpiryRateGuard)
export class SubscriptionExpiryController {
  constructor(private readonly service: SubscriptionExpiryService) {}
  @Get() summary(@Req() request: { user: ExpiryIdentity }) {
    return this.service.summary(request.user);
  }
  @Patch('preference') preferences(
    @Req() request: { user: ExpiryIdentity },
    @Body()
    body: {
      pushEnabled?: unknown;
      timezone?: unknown;
      quietStart?: unknown;
      quietEnd?: unknown;
    },
  ) {
    return this.service.preferences(request.user, body);
  }
  @Patch(':id/read') read(
    @Req() request: { user: ExpiryIdentity },
    @Param('id') id: string,
  ) {
    return this.service.read(request.user, id);
  }
}
