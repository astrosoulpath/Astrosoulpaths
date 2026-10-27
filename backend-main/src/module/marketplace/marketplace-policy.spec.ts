import { Prisma } from '@prisma/client';
import { marketplaceCommission, marketplacePage, validateMarketplaceImage } from './marketplace-policy';

describe('marketplace financial and input policy (no persistence)', () => {
  it.each([['100', '30', '70'], ['3500', '1050', '2450'], ['0.01', '0', '0.01'], ['0.05', '0.02', '0.03'], ['99.99', '30', '69.99'], ['0', '0', '0']])('snapshots INR %s exactly', (gross, fee, net) => {
    const result = marketplaceCommission(gross, 'INR');
    expect(result.platformFeeAmount.toString()).toBe(fee);
    expect(result.netAmount.toString()).toBe(net);
    expect(result.platformFeeAmount.add(result.netAmount).equals(new Prisma.Decimal(gross))).toBe(true);
  });
  it.each(['-1', '1.001', 'NaN', 'Infinity'])('rejects invalid amount %s', amount => expect(() => marketplaceCommission(amount, 'INR')).toThrow());
  it.each(['USD','JPY','EUR'])('never mixes unsupported currency %s', currency => expect(() => marketplaceCommission('100', currency)).toThrow());
  it('bounds default pagination', () => expect(marketplacePage()).toEqual({page:1,limit:24}));
  it('accepts maximum page size', () => expect(marketplacePage('2','100')).toEqual({page:2,limit:100}));
  it.each(['0','-1','1.5','1e3','10001','x'])('rejects invalid page %s', page => expect(() => marketplacePage(page)).toThrow());
  it('rejects oversized page size', () => expect(() => marketplacePage('1','101')).toThrow());
  it.each([
    ['image/png', Buffer.from([137,80,78,71,13,10,26,10])],
    ['image/jpeg', Buffer.from([255,216,255,0])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ])('accepts declared signature %s', (mimetype, buffer) => expect(() => validateMarketplaceImage({mimetype:mimetype as string,buffer:buffer as Buffer,size:buffer.length})).not.toThrow());
  it('rejects disguised script', () => expect(() => validateMarketplaceImage({mimetype:'image/png',buffer:Buffer.from('<script>'),size:8})).toThrow());
  it('rejects inconsistent byte length', () => expect(() => validateMarketplaceImage({mimetype:'image/jpeg',buffer:Buffer.from([255,216,255]),size:1})).toThrow());
});
