import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('current')
  @UseGuards(SupabaseAuthGuard)
  getCurrentSubscription(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.subscriptionService.getCurrentSubscription(
      user.sub as string,
    );
  }

  @Post('checkout')
  @UseGuards(SupabaseAuthGuard)
  createSubscription(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription(
      user.sub as string,
      dto,
    );
  }

  @Post('cancel')
  @UseGuards(SupabaseAuthGuard)
  cancelSubscription(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionService.cancelSubscription(
      user.sub as string,
      dto,
    );
  }
}