import { MarketplaceRefundJournal, refundComponents } from './marketplace-refund-journal';

const component = {sellerOrderId:'seller-one',currency:'INR',productMinor:70,discountMinor:0,shippingMinor:20,taxMinor:10,feeMinor:0};
const snapshot = {version:1,allocations:[component]};
describe('Confirmed refund to immutable journal recovery', () => {
  const old = process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED;
  let tx:any, db:any, journal:any, service:MarketplaceRefundJournal;
  beforeEach(() => {
    process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED='true';
    tx={$queryRaw:jest.fn().mockResolvedValueOnce([{state:'PROVIDER_CONFIRMED',amountMinor:100n,currency:'INR',componentSnapshot:snapshot,orderId:'order-one'}]).mockResolvedValue([{id:'seller-one'}])};
    db={$transaction:jest.fn(async fn=>fn(tx))};
    journal={appendInTransaction:jest.fn().mockResolvedValue({alreadyRecorded:false})};
    service=new MarketplaceRefundJournal(db,journal);
  });
  afterEach(()=>{if(old===undefined)delete process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED;else process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED=old;});
  it('is default-off and never contacts providers', async()=>{
    delete process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED;
    await expect(service.postConfirmed('attempt')).rejects.toThrow('not activated');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('posts in the same Serializable transaction after persisted ownership checks', async()=>{
    expect(await service.postConfirmed('attempt')).toEqual({financialJournalPosted:true,suborders:1});
    expect(db.$transaction.mock.calls[0][1]).toEqual({isolationLevel:'Serializable'});
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR UPDATE OF a');
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('c."customerUserId"=o."customerUserId"');
    expect(journal.appendInTransaction).toHaveBeenCalledWith(tx,'seller-one','refund:attempt:seller-one','REFUND',component);
  });
  it.each(['PREPARED','SUBMITTING','UNKNOWN','FAILED'])('rejects %s before posting',async state=>{
    tx.$queryRaw.mockReset().mockResolvedValue([{state}]);
    await expect(service.postConfirmed('attempt')).rejects.toThrow('ownership');
    expect(journal.appendInTransaction).not.toHaveBeenCalled();
  });
  it('rejects foreign suborders',async()=>{
    tx.$queryRaw.mockReset().mockResolvedValueOnce([{state:'PROVIDER_CONFIRMED',amountMinor:100n,currency:'INR',componentSnapshot:snapshot,orderId:'other'}]).mockResolvedValue([]);
    await expect(service.postConfirmed('attempt')).rejects.toThrow('suborder ownership');
    expect(journal.appendInTransaction).not.toHaveBeenCalled();
  });
  it('propagates transaction failure without automatic retry',async()=>{
    journal.appendInTransaction.mockRejectedValue(Error('synthetic rollback'));
    await expect(service.postConfirmed('attempt')).rejects.toThrow('synthetic rollback');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('recovery uses stable keys for idempotent journal replay',async()=>{
    await service.postConfirmed('attempt');
    expect(journal.appendInTransaction.mock.calls[0][2]).toBe('refund:attempt:seller-one');
  });
  it.each([null,{}, {version:2,allocations:[component]}, {version:1,allocations:[]}, {version:1,allocations:[component,component]}, {version:1,allocations:[{...component,feeMinor:1}]}, {version:1,allocations:[{...component,currency:'USD'}]}, {version:1,allocations:[{...component,productMinor:0.5}]}])('rejects unapproved/malformed components %#',value=>{
    expect(()=>refundComponents(value,100n,'INR')).toThrow();
  });
  it('rejects mismatch rather than allocating the missing money',()=>expect(()=>refundComponents(snapshot,101n,'INR')).toThrow('total mismatch'));
  it('sorts multi-seller locks consistently and copies persisted components',()=>{
    const result=refundComponents({version:1,allocations:[{...component,sellerOrderId:'z'}, {...component,sellerOrderId:'a'}]},200n,'INR');
    expect(result.map(x=>x.sellerOrderId)).toEqual(['a','z']);
    expect(result[0]).not.toBe(component);
  });
});
