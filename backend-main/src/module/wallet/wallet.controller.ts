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
import { RechargeWalletDto } from './dto/recharge-wallet.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(SupabaseAuthGuard)
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
  ) {}

  @Get()
  getWallet(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.walletService.getWallet(
      user.sub as string,
    );
  }

  @Get('history')
  getWalletHistory(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.walletService.getWalletHistory(
      user.sub as string,
    );
  }

  /**
   * Local testing endpoint.
   * Production me Razorpay verification use hogi.
   */
  @Post('recharge')
  rechargeWallet(
    @CurrentUser() user: JWTPayload,
    @Body() dto: RechargeWalletDto,
  ) {
    return this.walletService.rechargeWallet(
      user.sub as string,
      dto,
    );
  }
}