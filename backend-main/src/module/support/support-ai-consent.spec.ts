import { SupportAssistantService } from './support-assistant.service';
describe('explicit AI provider consent', () => {
  const prior = process.env.SUPPORT_AI_CONSENT_REQUIRED;
  afterEach(() => { if (prior === undefined) delete process.env.SUPPORT_AI_CONSENT_REQUIRED; else process.env.SUPPORT_AI_CONSENT_REQUIRED = prior; });
  it.each([undefined, false])('rejects %s before database, Redis or provider access', async (aiConsent) => {
    process.env.SUPPORT_AI_CONSENT_REQUIRED = 'true';
    const forbidden = new Proxy({}, { get() { throw new Error('External access before consent'); } });
    const service = new SupportAssistantService(forbidden as never, forbidden as never, forbidden as never, forbidden as never);
    await expect(service.sendCustomerMessage({ sub: 'synthetic' } as never, 'conversation', {content:'Help', aiConsent})).rejects.toThrow('Explicit AI support consent');
  });
});
