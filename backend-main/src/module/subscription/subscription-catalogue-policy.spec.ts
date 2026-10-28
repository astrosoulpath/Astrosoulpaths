import { Prisma } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { KUNDLI_YEARLY_PLAN } from './kundli-plan-policy';
import { DAILY_PLAN } from './daily-horoscope-policy';

describe('published subscription catalogue contract (mock persistence)', () => {
  it('lists only valid fixed-price products without mutating malformed or unrelated plans', async () => {
    const kundli = {name: KUNDLI_YEARLY_PLAN, price: new Prisma.Decimal(3500), currency: 'INR', durationDays: 365};
    const daily = {name: DAILY_PLAN, price: new Prisma.Decimal(1), currency: 'USD', durationDays: 30};
    const unrelated = {...daily, name: 'OTHER_EXISTING_PRODUCT', durationDays: 90};
    const plans = [kundli, daily, unrelated,
      {...kundli, price: new Prisma.Decimal(3000)}, {...kundli, durationDays: 30},
      {...kundli, currency: 'USD'}, {...daily, currency: 'INR'}, {...daily, durationDays: 31}];
    const db: any = {subscriptionPlan: {findMany: jest.fn().mockResolvedValue(plans), update: jest.fn()}};
    const result = await new SubscriptionService(db).getPlans();
    expect(result.data).toEqual([kundli, daily, unrelated]);
    expect(db.subscriptionPlan.findMany).toHaveBeenCalledWith({where: {isActive: true}, orderBy: {price: 'asc'}});
    expect(db.subscriptionPlan.update).not.toHaveBeenCalled();
    expect(plans).toHaveLength(8);
  });
});
