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
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { MarketplaceService } from './marketplace.service';
import { MarketplaceCaseService } from './marketplace-case.service';
import { ReviewMarketplaceCaseDto } from './dto/marketplace-case.dto';
import { ReconcileMarketplaceRefundDto } from './dto/reconcile-marketplace-refund.dto';
import { PrepareMarketplaceRefundDto } from './dto/prepare-marketplace-refund.dto';
import { ExecuteMarketplaceRefundDto } from './dto/execute-marketplace-refund.dto';

import { CreateMarketplaceCategoryDto } from './dto/create-marketplace-category.dto';
import { UpdateMarketplaceCategoryDto } from './dto/update-marketplace-category.dto';
import {
  MarketplaceModerationDto,
  MarketplaceRejectDto,
} from './dto/marketplace-moderation.dto';
import { CreateMarketplaceCampaignDto } from './dto/create-marketplace-campaign.dto';
import { UpdateMarketplaceCampaignDto } from './dto/update-marketplace-campaign.dto';
import { AddMarketplaceCampaignProductDto } from './dto/add-marketplace-campaign-product.dto';

@Controller('admin/marketplace')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class MarketplaceAdminController {
  constructor(private readonly marketplaceService: MarketplaceService, private readonly cases: MarketplaceCaseService) {}

  @Get('cases')
  getCases(@CurrentUser() user: JWTPayload) { return this.cases.list(user.sub as string, true); }

  @Post('refunds/:id/reconcile')
  reconcileRefund(@CurrentUser() user:JWTPayload,@Param('id') id:string,@Body() dto:ReconcileMarketplaceRefundDto) {
    return this.cases.reconcileRefund(user.sub as string,id,dto);
  }
  @Post('refunds/:id/execute-test')
  submitTestRefund(@CurrentUser() user:JWTPayload,@Param('id') id:string) {
    return this.cases.submitTestRefund(user.sub as string,id);
  }
  @Post('refunds/:id/execute')
  submitApprovedRefund(@CurrentUser() user: JWTPayload, @Param('id') id: string, @Body() dto: ExecuteMarketplaceRefundDto) {
    return this.cases.submitApprovedRefund(user.sub as string, id, dto.reason);
  }
  @Get('refunds/:id')
  refundStatus(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.cases.refundStatus(user.sub as string, id);
  }
  @Post('cases/:id/refund-intent')
  prepareRefund(@CurrentUser() user:JWTPayload,@Param('id') id:string,@Body() dto:PrepareMarketplaceRefundDto) {
    return this.cases.prepareRefund(user.sub as string,id,dto);
  }

  @Patch('cases/:id')
  reviewCase(@CurrentUser() user: JWTPayload, @Param('id') id: string, @Body() dto: ReviewMarketplaceCaseDto) {
    return this.cases.review(user.sub as string, id, dto);
  }

  @Get('sellers')
  getSellers() {
    return this.marketplaceService.adminGetSellers();
  }

  @Patch('sellers/:id/activate')
  activateSeller(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminActivateSeller(user.sub as string, id);
  }

  @Patch('sellers/:id/suspend')
  suspendSeller(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: MarketplaceModerationDto,
  ) {
    return this.marketplaceService.adminSuspendSeller(
      user.sub as string,
      id,
      dto.reason,
    );
  }

  @Patch('sellers/:id/reject')
  rejectSeller(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: MarketplaceRejectDto,
  ) {
    return this.marketplaceService.adminRejectSeller(
      user.sub as string,
      id,
      dto.reason,
    );
  }

  @Get('categories')
  getCategories() {
    return this.marketplaceService.adminGetCategories();
  }

  @Post('categories')
  createCategory(
    @CurrentUser() user: JWTPayload,
    @Body()
    dto: CreateMarketplaceCategoryDto,
  ) {
    return this.marketplaceService.adminCreateCategory(user.sub as string, dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body()
    dto: UpdateMarketplaceCategoryDto,
  ) {
    return this.marketplaceService.adminUpdateCategory(
      user.sub as string,
      id,
      dto,
    );
  }

  @Get('products')
  getProducts() {
    return this.marketplaceService.adminGetProducts();
  }

  @Patch('products/:id/approve')
  approveProduct(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminApproveProduct(user.sub as string, id);
  }

  @Patch('products/:id/reject')
  rejectProduct(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: MarketplaceRejectDto,
  ) {
    return this.marketplaceService.adminRejectProduct(
      user.sub as string,
      id,
      dto.reason,
    );
  }

  @Patch('products/:id/archive')
  archiveProduct(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: MarketplaceModerationDto,
  ) {
    return this.marketplaceService.adminArchiveProduct(
      user.sub as string,
      id,
      dto.reason,
    );
  }

  @Patch('products/:id/feature')
  featureProduct(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminSetProductFeatured(
      user.sub as string,
      id,
      true,
    );
  }

  @Patch('products/:id/unfeature')
  unfeatureProduct(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminSetProductFeatured(
      user.sub as string,
      id,
      false,
    );
  }

  @Get('campaigns')
  getCampaigns() {
    return this.marketplaceService.adminGetCampaigns();
  }

  @Post('campaigns')
  createCampaign(
    @CurrentUser() user: JWTPayload,
    @Body()
    dto: CreateMarketplaceCampaignDto,
  ) {
    return this.marketplaceService.adminCreateCampaign(user.sub as string, dto);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @CurrentUser() user: JWTPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceCampaignDto,
  ) {
    return this.marketplaceService.adminUpdateCampaign(
      user.sub as string,
      id,
      dto,
    );
  }

  @Post('campaigns/:campaignId/products/:productId')
  addCampaignProduct(
    @CurrentUser() user: JWTPayload,
    @Param('campaignId')
    campaignId: string,

    @Param('productId')
    productId: string,

    @Body()
    dto: AddMarketplaceCampaignProductDto,
  ) {
    return this.marketplaceService.adminAddCampaignProduct(
      user.sub as string,
      campaignId,
      productId,
      dto,
    );
  }

  @Delete('campaigns/:campaignId/products/:productId')
  removeCampaignProduct(
    @CurrentUser() user: JWTPayload,
    @Param('campaignId')
    campaignId: string,

    @Param('productId')
    productId: string,
  ) {
    return this.marketplaceService.adminRemoveCampaignProduct(
      user.sub as string,
      campaignId,
      productId,
    );
  }

  @Patch('campaigns/:id/activate')
  activateCampaign(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminActivateCampaign(
      user.sub as string,
      id,
    );
  }

  @Patch('campaigns/:id/pause')
  pauseCampaign(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminPauseCampaign(user.sub as string, id);
  }

  @Patch('campaigns/:id/cancel')
  cancelCampaign(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.marketplaceService.adminCancelCampaign(user.sub as string, id);
  }

  @Get('orders')
  getMarketplaceOrders() {
    return this.marketplaceService.adminGetMarketplaceOrders();
  }

  @Get('orders/:id')
  getMarketplaceOrder(@Param('id') id: string) {
    return this.marketplaceService.adminGetMarketplaceOrder(id);
  }

  @Get('earnings')
  getMarketplaceEarnings() {
    return this.marketplaceService.adminGetMarketplaceEarnings();
  }

  @Get('payouts')
  getMarketplacePayouts() {
    return this.marketplaceService.adminGetMarketplacePayouts();
  }
}
