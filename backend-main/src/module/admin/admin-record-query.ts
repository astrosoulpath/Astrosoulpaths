import { BadRequestException } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';

function filters(search: unknown, status: unknown, statuses: string[]) {
  if ((search !== undefined && typeof search !== 'string') || (status !== undefined && typeof status !== 'string')) throw new BadRequestException('Invalid record filters');
  const query = (search as string | undefined)?.trim() ?? '';
  const state = (status as string | undefined)?.trim().toUpperCase() ?? '';
  if (query.length > 100 || (state && state !== 'ALL' && !statuses.includes(state))) throw new BadRequestException('Invalid record filters');
  return { query, state: state === 'ALL' ? '' : state };
}
export function paymentWhere(search?: string, status?: string): Prisma.PaymentOrderWhereInput {
  const {query, state}=filters(search,status,Object.values(PaymentStatus));
  return {
    ...(state ? {status: state as PaymentStatus} : {}),
    ...(query ? {OR:[{id:{contains:query,mode:'insensitive'}},{razorpayOrderId:{contains:query,mode:'insensitive'}},{razorpayPaymentId:{contains:query,mode:'insensitive'}},{user:{name:{contains:query,mode:'insensitive'}}},{user:{email:{contains:query,mode:'insensitive'}}},{user:{phone:{contains:query,mode:'insensitive'}}},{user:{userProfile:{fullName:{contains:query,mode:'insensitive'}}}}]} : {}),
  };
}
export function subscriptionWhere(search?: string, status?: string): Prisma.SubscriptionWhereInput {
  const {query,state}=filters(search,status,Object.values(SubscriptionStatus));
  return {
    ...(state ? {subscriptionStatus:state as SubscriptionStatus} : {}),
    ...(query ? {OR:[{id:{contains:query,mode:'insensitive'}},{userId:{contains:query,mode:'insensitive'}},{user:{name:{contains:query,mode:'insensitive'}}},{user:{email:{contains:query,mode:'insensitive'}}},{user:{phone:{contains:query,mode:'insensitive'}}},{user:{userProfile:{fullName:{contains:query,mode:'insensitive'}}}},{subscriptionPlan:{name:{contains:query,mode:'insensitive'}}}]} : {}),
  };
}
