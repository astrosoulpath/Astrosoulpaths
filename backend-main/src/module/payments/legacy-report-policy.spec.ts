import { legacyReportPrice } from './legacy-report-policy';
describe('Standalone report price boundary', () => {
  const prior = {...process.env};
  afterEach(() => {process.env={...prior};});
  it('fails closed without separate product approval', () => {
    delete process.env.KUNDLI_LEGACY_REPORT_CHECKOUT_APPROVED;
    expect(legacyReportPrice).toThrow('approved server pricing');
  });
  it.each(['', '-1', '0', '1.001', 'Infinity', '90071992547410'])('rejects invalid configured price %s', price => {
    process.env.KUNDLI_LEGACY_REPORT_CHECKOUT_APPROVED='true';
    process.env.KUNDLI_LEGACY_REPORT_PRICE_INR=price;
    expect(legacyReportPrice).toThrow();
  });
  it('uses exact approved server price independently of client amount', () => {
    process.env.KUNDLI_LEGACY_REPORT_CHECKOUT_APPROVED='true';
    process.env.KUNDLI_LEGACY_REPORT_PRICE_INR='123.45';
    expect(legacyReportPrice().toFixed(2)).toBe('123.45');
  });
});
