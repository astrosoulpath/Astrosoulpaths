import { ConsultationRepository } from './consultation.repository';
import { AstrologerService } from '../astrologer/astrologer.service';
import { WalletService } from '../wallet/wallet.service';
import { LocalizedPricingService } from '../payments/pricing/localized-pricing.service';
import { FxRateService } from '../payments/pricing/fx-rate.service';
import { Prisma } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';

describe('customer Stage 2 boundaries (mocked persistence/providers)', () => {
  it.each(['USD','EUR',undefined])('never credits a mismatched payment/wallet currency %s',async currency=>{
    const tx:any={wallet:{findUnique:jest.fn().mockResolvedValue({id:'wallet',currency}),update:jest.fn()}};
    const service:any=Object.create(PaymentsService.prototype);
    await expect(service.creditWallet(tx,'wallet',new Prisma.Decimal(10),new Prisma.Decimal(10),new Prisma.Decimal(0),'INR')).rejects.toThrow('currency must match');
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it.each(['USD','EUR',undefined])('rejects unsupported paid wallet currency %s before session or reservation writes',async currency=>{
    const tx:any={callSession:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()},wallet:{upsert:jest.fn().mockResolvedValue({id:'wallet',currency,balance:new Prisma.Decimal(100),lockedBalance:new Prisma.Decimal(0)}),update:jest.fn()}};
    const repo=new ConsultationRepository({$transaction:async(fn:any)=>fn(tx)} as any);
    await expect(repo.createConsultation({userId:'synthetic',mode:'audio',purchasedMinutes:5,amountCharged:10} as any)).rejects.toThrow('INR wallet');
    expect(tx.wallet.update).not.toHaveBeenCalled();expect(tx.callSession.create).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5])('rejects invalid wallet page %s before ownership or DB access',async page=>{
    await expect(new WalletService({} as any).getWalletHistory('owner',page)).rejects.toThrow('pagination');
  });
  it('wallet pagination remains owner scoped and deterministically ordered',async()=>{
    const db:any={wallet:{upsert:jest.fn().mockResolvedValue({id:'wallet'})},walletLedger:{findMany:jest.fn().mockResolvedValue([])}};
    const service=new WalletService(db);jest.spyOn(service as any,'findUserBySupabaseId').mockResolvedValue({id:'canonical'});
    await service.getWalletHistory('subject',2,20);
    expect(db.walletLedger.findMany).toHaveBeenCalledWith({where:{walletId:'wallet',userId:'canonical'},skip:20,take:20,orderBy:[{createdAt:'desc'},{id:'desc'}]});
  });
  it.each([{base:'EUR',timestamp:1,rates:{}},{base:'USD',timestamp:NaN,rates:{}},{base:'USD',timestamp:1,rates:[]}])('rejects malformed FX payload without fallback',async body=>{
    const old=process.env.OPEN_EXCHANGE_RATES_APP_ID;process.env.OPEN_EXCHANGE_RATES_APP_ID='synthetic';
    const mock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>body} as any);
    try{await expect(new FxRateService().getRate('INR','USD')).rejects.toThrow('invalid response');}
    finally{mock.mockRestore();if(old===undefined)delete process.env.OPEN_EXCHANGE_RATES_APP_ID;else process.env.OPEN_EXCHANGE_RATES_APP_ID=old;}
  });
  it('customer history list and count use the same authenticated owner with stable ordering', async () => {
    const db: any = { callSession: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    await new ConsultationRepository(db).findUserConsultationHistory('owner', { page: 2, limit: 10 });
    expect(db.callSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' }, skip: 10, take: 10, orderBy: [{createdAt: 'desc'}, {id: 'desc'}] }));
    expect(db.callSession.count).toHaveBeenCalledWith({where: {userId: 'owner'}});
  });
  it('public profile excludes disabled, blocked and non-astrologer accounts', async () => {
    const db: any = { astrologer: {findFirst: jest.fn().mockResolvedValue(null)} };
    await expect(new AstrologerService(db, {} as any, {} as any).getPublicAstrologerById('profile')).rejects.toThrow();
    expect(db.astrologer.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({isApproved: true, isVerified: true, user: {is: {isActive: true, isBlocked: false, isAstrologer: true}}})}));
  });
  it.each([false, true])('public profile exposes actual busy state %s', async busy => {
    const db: any = {astrologer: {findFirst: jest.fn().mockResolvedValue({id:'profile', user:{id:'canonical',name:'Synthetic'}, languages:[],expertise:[],isOnline:true})},callSession:{findFirst:jest.fn().mockResolvedValue(busy ? {expiresAt:new Date(Date.now()+120000)} : null)}};
    const result = await new AstrologerService(db, {} as any, {} as any).getPublicAstrologerById('profile');
    expect(result.data.isBusy).toBe(busy); expect(result.data.isVerified).toBe(true);
    expect(db.callSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({astrologerId:'canonical',status:'ACTIVE',endedAt:null})}));
  });
  it.each(['production','development',undefined])('direct unverified recharge fails closed in %s without DB access', async env => {
    const oldEnv=process.env.NODE_ENV, oldGate=process.env.ALLOW_LOCAL_WALLET_RECHARGE;
    try {
      if(env)process.env.NODE_ENV=env;else delete process.env.NODE_ENV;
      delete process.env.ALLOW_LOCAL_WALLET_RECHARGE;
      const db:any={$transaction:jest.fn()};
      await expect(new WalletService(db).rechargeWallet('subject',{amount:100})).rejects.toThrow('disabled');
      expect(db.$transaction).not.toHaveBeenCalled();
    } finally {
      if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;
      if(oldGate===undefined)delete process.env.ALLOW_LOCAL_WALLET_RECHARGE;else process.env.ALLOW_LOCAL_WALLET_RECHARGE=oldGate;
    }
  });
  it.each([['INR', '3500.00'],['JPY','3500'],['KWD','3500.000']])('pricing preserves %s minor units', async(currency,expected)=>{
    const country=currency==='INR'?'IN':currency==='JPY'?'JP':'KW';
    const service=new LocalizedPricingService({getRate:jest.fn().mockResolvedValue({rate:1,source:'openexchangerates',providerTimestamp:new Date(0)})} as any);
    const quote=await service.quotePrice({baseAmount:3500,baseCurrency:'INR',countryCode:country});
    expect(quote.currency).toBe(currency);expect(quote.amount).toBe(expected);
  });
});
