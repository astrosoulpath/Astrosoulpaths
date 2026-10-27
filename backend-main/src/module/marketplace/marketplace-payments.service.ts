import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { VerifyMarketplacePaymentDto } from './dto/verify-marketplace-payment.dto';

// Provider selection stays server-side. Existing mobile/website receipt contracts
// remain supported; another adapter must implement equivalent backend verification.
export interface MarketplacePaymentPort {
  createOrder(subject: string, orderId: string): Promise<unknown>;
  verifyPayment(subject: string, orderId: string, receipt: VerifyMarketplacePaymentDto): Promise<unknown>;
  refund(): Promise<never>;
}

@Injectable()
export class MarketplacePaymentsService implements MarketplacePaymentPort {
  constructor(private readonly marketplace: MarketplaceService) {}
  createOrder(subject: string, orderId: string) {
    // Existing backend gate and authoritative amount/currency snapshot remain mandatory.
    return this.marketplace.createMarketplaceRazorpayOrder(subject, orderId);
  }
  verifyPayment(subject: string, orderId: string, receipt: VerifyMarketplacePaymentDto) {
    return this.marketplace.verifyMarketplaceRazorpayPayment(subject, orderId, receipt);
  }
  async refund(): Promise<never> {
    throw new ServiceUnavailableException('Marketplace provider refunds require an approved adapter and reconciliation policy');
  }
}
