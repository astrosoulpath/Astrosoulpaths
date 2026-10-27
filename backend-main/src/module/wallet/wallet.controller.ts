import { Body, Controller, Get, Post, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(SupabaseAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@CurrentUser() user: JWTPayload) {
    return this.walletService.getWallet(user.sub as string);
  }

  @Get('recharge-packs')
  getRechargePacks() {
    return this.walletService.getRechargePacks();
  }
  @Get('history')
  getWalletHistory(@CurrentUser() user: JWTPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) {
    return this.walletService.getWalletHistory(user.sub as string, page, limit);
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
    return this.walletService.rechargeWallet(user.sub as string, dto);
  }
}
