import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import type { JWTPayload } from 'jose';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { MarketplaceService } from './marketplace.service';
import { CreateMarketplaceProductDto } from './dto/create-marketplace-product.dto';
import { UpdateMarketplaceProductDto } from './dto/update-marketplace-product.dto';
import { UpsertMarketplaceSellerProfileDto } from './dto/upsert-marketplace-seller-profile.dto';
import { ShipMarketplaceOrderDto } from './dto/ship-marketplace-order.dto';

@Controller('marketplace/seller')
@UseGuards(SupabaseAuthGuard)
export class MarketplaceSellerController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getSellerProfile(user.sub as string);
  }

  @Post('profile')
  saveProfile(
    @CurrentUser() user: JWTPayload,
    @Body()
    dto: UpsertMarketplaceSellerProfileDto,
  ) {
    return this.marketplaceService.requestOrUpdateSellerProfile(
      user.sub as string,
      dto,
    );
  }

  @Get('products')
  getProducts(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getSellerProducts(user.sub as string);
  }

  @Post('products')
  createProduct(
    @CurrentUser() user: JWTPayload,
    @Body()
    dto: CreateMarketplaceProductDto,
  ) {
    return this.marketplaceService.createSellerProduct(user.sub as string, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body()
    dto: UpdateMarketplaceProductDto,
  ) {
    return this.marketplaceService.updateSellerProduct(
      user.sub as string,
      id,
      dto,
    );
  }

  @Patch('products/:id/archive')
  archiveProduct(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.archiveSellerProduct(user.sub as string, id);
  }

  @Post('products/:id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  uploadProductImage(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.marketplaceService.uploadSellerProductImage(
      user.sub as string,
      id,
      file,
    );
  }

  @Post('products/:id/submit')
  submitProduct(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.submitSellerProduct(user.sub as string, id);
  }

  @Get('orders')
  getOrders(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getSellerOrders(user.sub as string);
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.getSellerOrder(user.sub as string, id);
  }

  @Patch('orders/:id/accept')
  acceptOrder(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.acceptSellerOrder(user.sub as string, id);
  }

  @Patch('orders/:id/process')
  processOrder(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.processSellerOrder(user.sub as string, id);
  }

  @Patch('orders/:id/ship')
  shipOrder(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: ShipMarketplaceOrderDto,
  ) {
    return this.marketplaceService.shipSellerOrder(user.sub as string, id, dto);
  }

  @Patch('orders/:id/deliver')
  deliverOrder(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.deliverSellerOrder(user.sub as string, id);
  }

  @Get('earnings')
  getMarketplaceEarnings(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getSellerMarketplaceEarnings(
      user.sub as string,
    );
  }

  @Post('payouts/request')
  requestMarketplacePayout(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.requestSellerMarketplacePayout(
      user.sub as string,
    );
  }
  @Get('payouts')
  getMarketplacePayouts(@CurrentUser() user: JWTPayload) {
    return this.marketplaceService.getSellerMarketplacePayouts(
      user.sub as string,
    );
  }
}
