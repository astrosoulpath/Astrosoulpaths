import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { AddMarketplaceCartItemDto } from './dto/add-marketplace-cart-item.dto';
import { UpdateMarketplaceCartItemDto } from './dto/update-marketplace-cart-item.dto';
import { CreateMarketplaceAddressDto } from './dto/create-marketplace-address.dto';
import { UpdateMarketplaceAddressDto } from './dto/update-marketplace-address.dto';
import { PrepareMarketplaceOrderDto } from './dto/prepare-marketplace-order.dto';
import { MarketplaceService } from './marketplace.service';
import { VerifyMarketplacePaymentDto } from './dto/verify-marketplace-payment.dto';

@Controller('marketplace/customer')
@UseGuards(SupabaseAuthGuard)
export class MarketplaceCustomerController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('cart')
  getCart(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getCustomerCart(user.sub as string);
  }

  @Post('cart/items')
  addCartItem(
    @CurrentUser() user: JWTPayload,
    @Body() dto: AddMarketplaceCartItemDto,
  ) {
    return this.marketplaceService.addCustomerCartItem(user.sub as string, dto);
  }

  @Patch('cart/items/:id')
  updateCartItem(
    @CurrentUser() user: JWTPayload,
    @Param('id') itemId: string,
    @Body() dto: UpdateMarketplaceCartItemDto,
  ) {
    return this.marketplaceService.updateCustomerCartItem(
      user.sub as string,
      itemId,
      dto,
    );
  }

  @Delete('cart/items/:id')
  removeCartItem(@CurrentUser() user: JWTPayload, @Param('id') itemId: string) {
    return this.marketplaceService.removeCustomerCartItem(
      user.sub as string,
      itemId,
    );
  }

  @Get('addresses')
  getAddresses(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getCustomerAddresses(user.sub as string);
  }

  @Post('addresses')
  createAddress(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreateMarketplaceAddressDto,
  ) {
    return this.marketplaceService.createCustomerAddress(
      user.sub as string,
      dto,
    );
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser() user: JWTPayload,
    @Param('id') addressId: string,
    @Body() dto: UpdateMarketplaceAddressDto,
  ) {
    return this.marketplaceService.updateCustomerAddress(
      user.sub as string,
      addressId,
      dto,
    );
  }

  @Patch('addresses/:id/default')
  setDefaultAddress(
    @CurrentUser() user: JWTPayload,
    @Param('id') addressId: string,
  ) {
    return this.marketplaceService.setCustomerDefaultAddress(
      user.sub as string,
      addressId,
    );
  }

  @Delete('addresses/:id')
  deleteAddress(
    @CurrentUser() user: JWTPayload,
    @Param('id') addressId: string,
  ) {
    return this.marketplaceService.deleteCustomerAddress(
      user.sub as string,
      addressId,
    );
  }

  @Post('orders/prepare')
  prepareOrder(
    @CurrentUser() user: JWTPayload,
    @Body() dto: PrepareMarketplaceOrderDto,
  ) {
    return this.marketplaceService.prepareCustomerOrder(
      user.sub as string,
      dto,
    );
  }

  @Get('orders')
  getOrders(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getCustomerOrders(user.sub as string);
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() user: JWTPayload, @Param('id') orderId: string) {
    return this.marketplaceService.getCustomerOrder(
      user.sub as string,
      orderId,
    );
  }

  @Post('orders/:orderId/payment/razorpay')
  createRazorpayOrder(
    @CurrentUser() user: JWTPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.marketplaceService.createMarketplaceRazorpayOrder(
      user.sub as string,
      orderId,
    );
  }

  @Post('orders/:orderId/payment/verify')
  verifyRazorpayPayment(
    @CurrentUser() user: JWTPayload,
    @Param('orderId') orderId: string,
    @Body() dto: VerifyMarketplacePaymentDto,
  ) {
    return this.marketplaceService.verifyMarketplaceRazorpayPayment(
      user.sub as string,
      orderId,
      dto,
    );
  }
}
