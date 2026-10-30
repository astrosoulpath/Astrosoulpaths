import { AdminReportService } from './admin-report.service';
import { integrationReportRows } from './admin-integration-reports';
import { AdminController } from './admin.controller';
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(), decodeProtectedHeader: jest.fn(), jwtVerify: jest.fn() }));
describe('cross-client authoritative reports',()=>{
  it('uses persisted charges and earnings instead of treating a share as gross',async()=>{
    const db={callSession:{findMany:jest.fn(async()=>[{id:'call',userId:'same-canonical-owner',astrologerId:'astro',amountCharged:100,isFreeChat:false,earning:{grossAmount:100,netAmount:70,platformFee:30,currency:'INR'}}])}};
    const result=await new AdminReportService(db as never).generateReport({reportType:'CONSULTATIONS',format:'CSV'});
    expect(result.totalRecords).toBe(1);expect(result.data.toString()).toContain('"recordedGross","platformFee","astrologerShare","currency","isFreeChat"');expect(result.data.toString()).toContain('"100","100","30","70","INR"');
  });
  it('neutralizes spreadsheet formulas in customer text without altering numeric ledger values',async()=>{
    const db={supportTicket:{findMany:jest.fn(async()=>[{id:'ticket',subject:'=HYPERLINK("unsafe")',customerId:'owner'}])}};
    const report=await new AdminReportService(db as never).generateReport({reportType:'SUPPORT_TICKETS',format:'CSV'});
    expect(report.totalRecords).toBe(1);expect(report.data.toString()).toContain("'=HYPERLINK");
  });
  it('keeps historical mode UNKNOWN regardless of current gateway settings',async()=>{
    const db={paymentOrder:{findMany:jest.fn(async()=>[{id:'old',metadata:{},currency:'USD',amount:1}])}};
    expect((await new AdminReportService(db as never).generateReport({reportType:'PAYMENTS',format:'CSV'})).data.toString()).toContain('UNKNOWN');
  });
  it('does not label inbox records as confirmed device delivery',async()=>{
    const prior=process.env.SUPPORT_OPERATIONS_SCHEMA_READY,expiry=process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY;delete process.env.SUPPORT_OPERATIONS_SCHEMA_READY;delete process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY;
    try{const rows=await integrationReportRows({appNotification:{findMany:async()=>[{id:'n',userId:'owner',type:'support_ticket',isRead:false,createdAt:new Date()}]}} as never,'NOTIFICATIONS',{});expect(rows[0].state).toBe('RECORDED');expect(rows[0].source).toBe('INBOX');}finally{if(prior===undefined)delete process.env.SUPPORT_OPERATIONS_SCHEMA_READY;else process.env.SUPPORT_OPERATIONS_SCHEMA_READY=prior;if(expiry===undefined)delete process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY;else process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY=expiry;}
  });
  it('fails closed for inactive refund audit storage',async()=>{const prior=process.env.PAYMENT_CREATION_SCHEMA_READY;delete process.env.PAYMENT_CREATION_SCHEMA_READY;try{await expect(integrationReportRows({} as never,'REFUNDS',{})).rejects.toThrow('not activated');}finally{if(prior!==undefined)process.env.PAYMENT_CREATION_SCHEMA_READY=prior;}});
  it('requires verified operator proof even if the report controller is called directly',async()=>{const generateReport=jest.fn();const controller=new AdminController({} as never,{} as never,{generateReport} as never,{} as never);await expect(controller.generateReport({user:{role:'ADMIN'}},{reportType:'PAYMENTS'},{} as never)).rejects.toThrow();expect(generateReport).not.toHaveBeenCalled();});
});
