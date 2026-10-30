import * as fs from 'fs';
import * as path from 'path';
import {createHash} from 'crypto';
// Source checks are not a claim that archived rehearsal output verifies every future schema.
describe('portable fresh migration source integrity',()=>{
 const root=path.resolve(__dirname,'../../../..');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'review/payments/fresh-prisma-release-manifest.review.json'),'utf8'));
 const hash=(file:string)=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 it('current authoritative schema and fresh kit remain aligned',()=>{
  expect(hash('backend-main/prisma/schema.prisma')).toBe(manifest.schemaSha256);
  expect(hash('review/payments/fresh-production-prisma/schema.prisma')).toBe(manifest.schemaSha256);
 });
 it.each(manifest.files as {migration:string;sha256:string}[])('pins prepared migration $migration',entry=>{
  expect(hash('review/payments/fresh-production-prisma/migrations/'+entry.migration+'/migration.sql')).toBe(entry.sha256);
 });
 it('retains payment/refund SQL protections',()=>{
  const sql=fs.readFileSync(path.join(root,'review/payments/fresh-production-prisma/migrations/20261027000200_fresh_sql_protections/migration.sql'),'utf8');
  expect(sql).toContain('payment_orders');expect(sql).toContain('wallet_ledger');
  const guards=fs.readFileSync(path.join(root,'review/payments/fresh-production-prisma/migrations/20261027000400_product_refund_reservation_guards/migration.sql'),'utf8');
  expect(guards).toContain('wallet_ledger_single_principal_refund');
 });
});
