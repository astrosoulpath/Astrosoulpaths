const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('src/features/admin/payment-totals.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const context={exports:{}};vm.runInNewContext(compiled,context);
const totals=rows=>JSON.parse(JSON.stringify(context.exports.paymentTotals(rows)));
test('Admin totals never combine INR and USD or imply FX conversion',()=>{
 assert.deepEqual(totals([{amount:'3500',currency:'INR'},{amount:'1',currency:'USD'},{amount:'2',currency:'USD'}]),{totals:[{currency:'INR',amount:'3500.00'},{currency:'USD',amount:'3.00'}],unavailable:0});
});
test('minor-unit display aggregation preserves decimal precision',()=>{
 assert.equal(totals([{amount:'0.10',currency:'INR'},{amount:'0.20',currency:'INR'}]).totals[0].amount,'0.30');
});
test('missing currency and invalid amount stay unknown instead of becoming INR zero',()=>{
 assert.deepEqual(totals([{amount:'1'},{amount:null,currency:'INR'},{amount:'NaN',currency:'USD'}]),{totals:[],unavailable:3});
});
test('refund display never silently substitutes original payment amount',()=>{
 const page=fs.readFileSync('src/app/admin/payments/page.tsx','utf8');
 assert.doesNotMatch(page,/payment\.refundAmount\s*\?\?\s*payment\.amount/);
 assert.match(page,/Payments on this page/);
});
