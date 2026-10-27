import { BadGatewayException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { minor } from './marketplace-accounting';

type Transport = (url:string, init:RequestInit)=>Promise<{ok:boolean;json():Promise<any>}>;
export interface MarketplaceRefundReceipt { id:string;payment_id:string;amount:number;currency:string;status:'pending'|'processed'|'failed' }

// Test-only port, deliberately not registered in DI or reachable from a route.
// Durable authorized refund orchestration must be approved before wiring it up.
export class MarketplaceRazorpayTestAdapter {
  constructor(private readonly config:{keyId:string;secret:string;webhookSecret:string;approved:boolean},private readonly transport:Transport) {}
  private enabled(){
    if(!this.config.approved || !/^rzp_test_[A-Za-z0-9]+$/.test(this.config.keyId) || !this.config.secret || !this.config.webhookSecret) throw new ServiceUnavailableException('Approved Razorpay test configuration required');
  }
  verifyRawWebhook(raw:Buffer, signature:string){
    this.enabled();
    if(!Buffer.isBuffer(raw)||!raw.length||raw.length>1024*1024||!/^[a-f0-9]{64}$/.test(signature)) throw new BadRequestException('Invalid webhook envelope');
    const expected=createHmac('sha256',this.config.webhookSecret).update(raw).digest();
    if(!timingSafeEqual(expected,Buffer.from(signature,'hex'))) throw new BadRequestException('Invalid webhook signature');
    try{return JSON.parse(raw.toString('utf8'));}catch{throw new BadRequestException('Invalid webhook JSON');}
  }
  private async request(path:string, method='GET', body?:unknown,key?:string){
    this.enabled();
    try{
      const response=await this.transport('https://api.razorpay.com/v1/'+path,{method,headers:{Authorization:'Basic '+Buffer.from(this.config.keyId+':'+this.config.secret).toString('base64'),'Content-Type':'application/json',...(key?{'X-Refund-Idempotency':key}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error();
      return await response.json();
    }catch{throw new BadGatewayException('Razorpay test request requires reconciliation');}
  }
  async verifyCaptured(input:{paymentId:string;orderId:string;signature:string;amount:number;currency:string}){
    this.enabled();minor(input.amount);
    if(!/^pay_[A-Za-z0-9]+$/.test(input.paymentId)||!/^order_[A-Za-z0-9]+$/.test(input.orderId)||input.currency!=='INR'||!/^[a-f0-9]{64}$/.test(input.signature)) throw new BadRequestException('Invalid payment receipt');
    const expected=createHmac('sha256',this.config.secret).update(input.orderId+'|'+input.paymentId).digest();
    if(!timingSafeEqual(expected,Buffer.from(input.signature,'hex'))) throw new BadRequestException('Invalid payment signature');
    const payment=await this.request('payments/'+input.paymentId);
    if(payment.id!==input.paymentId||payment.order_id!==input.orderId||payment.amount!==input.amount||payment.currency!==input.currency||payment.status!=='captured') throw new BadRequestException('Payment reconciliation mismatch');
    return {verified:true as const};
  }
  async refund(input:{paymentId:string;amount:number;idempotencyKey:string}):Promise<MarketplaceRefundReceipt>{
    this.enabled();minor(input.amount);
    if(input.amount<100||!/^pay_[A-Za-z0-9]+$/.test(input.paymentId)||!/^[A-Za-z0-9_-]{10,200}$/.test(input.idempotencyKey)) throw new BadRequestException('Invalid test refund request');
    const r=await this.request('payments/'+input.paymentId+'/refund','POST',{amount:input.amount,speed:'normal'},input.idempotencyKey);
    return this.receipt(r,input.paymentId,input.amount);
  }
  async fetchRefund(id:string,paymentId:string,amount:number){
    if(!/^rfnd_[A-Za-z0-9]+$/.test(id)) throw new BadRequestException('Invalid refund identity');
    return this.receipt(await this.request('refunds/'+id),paymentId,amount);
  }
  private receipt(r:any,paymentId:string,amount:number):MarketplaceRefundReceipt{
    if(!/^rfnd_[A-Za-z0-9]+$/.test(r?.id)||r.payment_id!==paymentId||r.amount!==amount||r.currency!=='INR'||!['pending','processed','failed'].includes(r.status)) throw new BadRequestException('Refund reconciliation mismatch');
    // Return a strict projection; never provider notes, customer fields or secrets.
    return {id:r.id,payment_id:r.payment_id,amount:r.amount,currency:r.currency,status:r.status};
  }
}
