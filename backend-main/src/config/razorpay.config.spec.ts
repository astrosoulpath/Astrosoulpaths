jest.mock('razorpay', () => ({__esModule: true, default: jest.fn().mockImplementation(() => ({}))}));

describe('Razorpay credential mode gate', () => {
  const original = {...process.env};
  beforeEach(() => {
    jest.resetModules();
    process.env.RAZORPAY_KEY_ID = 'rzp_test_synthetic';
    process.env.RAZORPAY_KEY_SECRET = 'synthetic-secret';
    delete process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED;
  });
  afterEach(() => { process.env = {...original}; });
  const get = () => require('./razorpay.config').getRazorpayInstance();
  it('allows test mode without enabling live operations', () => expect(get()).toBeDefined());
  it('rejects unapproved live credentials before constructing SDK', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_synthetic';
    expect(get).toThrow('disabled');
  });
  it('validates the gate even when a client was cached', () => {
    get(); process.env.RAZORPAY_KEY_ID = 'rzp_live_synthetic';
    expect(get).toThrow('disabled');
  });
  it('rejects missing and malformed configuration without revealing it', () => {
    process.env.RAZORPAY_KEY_ID = 'invalid-sensitive-value';
    expect(get).toThrow('key mode is invalid');
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(get).toThrow('configuration is unavailable');
  });
});
