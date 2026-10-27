import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

describe('Payment Stage 2 rehearsal integrity',()=>{
  const root=path.resolve(__dirname,'../../..');
  const evidence=JSON.parse(fs.readFileSync(path.join(root,'review/payments/stage2-postgres-result-schema-aligned.json'),'utf8'));
  const hash=(file:string)=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  it('rehearsed the exact current Prisma schema after additive Stage 4 changes',()=>{
    const latest=JSON.parse(fs.readFileSync(path.join(root,'review/payments/stage4-postgres-result-final.json'),'utf8'));
    expect(latest).toMatchObject({status:'PASS',existingApplicationConnections:0,providerCalls:0,containerRemoved:true});
    expect(hash('prisma/schema.prisma')).toBe(latest.schemaSha256);
    expect(hash('prisma/migrations/20261022130000_marketplace_checkout_snapshots/migration.sql')).toBe(latest.snapshotMigrationSha256);
  });
  it('rehearsed the exact prepared integrity SQL',()=>expect(hash('prisma/migrations/20261022110000_payment_reference_integrity/migration.sql')).toBe(evidence.migrationSha256));
  it('rehearsed the exact prepared refund SQL',()=>expect(hash('prisma/migrations/20261022111500_marketplace_refund_workflow/migration.sql')).toBe(evidence.refundMigrationSha256));
  it('used only isolated synthetic records and removed its container',()=>{
    expect(evidence).toMatchObject({status:'PASS',existingApplicationConnections:0,providerCalls:0,containerRemoved:true});
    expect(evidence.checks.length).toBeGreaterThanOrEqual(21);
  });
});
