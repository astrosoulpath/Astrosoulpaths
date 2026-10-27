import { BadRequestException } from '@nestjs/common';
import {
  SupportCatalogueService,
  DEFAULT_SUPPORT_CATALOGUE,
  validateSupportCatalogue,
} from './support-catalogue.service';
import { validatePublicHelp } from './public-support-policy';
import { SupportPublicController } from './support-public.controller';

const help = () => ({
  published: true,
  email: 'help@example.invalid',
  hours: 'Synthetic approved hours',
  responseTime: 'Synthetic approved response guidance',
  faqs: [
    {
      id: 'faq-one',
      question: 'Synthetic question',
      answer: 'Synthetic public answer',
      category: 'ACCOUNT',
      enabled: true,
    },
  ],
});
describe('public support publication (synthetic, no database/provider)', () => {
  const environment = { ...process.env };
  afterEach(() => {
    process.env = { ...environment };
  });
  it('defaults to unpublished and does not invent email, hours, SLA or answers', async () => {
    process.env.SUPPORT_OPERATIONS_ENABLED = 'false';
    const db: any = { $queryRaw: jest.fn() };
    const result = await new SupportCatalogueService(db).publicHelp();
    expect(result).toMatchObject({
      success: true,
      published: false,
      contact: null,
      faqs: [],
    });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('preserves legacy catalogues without adding or publishing fields', () => {
    expect(
      validateSupportCatalogue(structuredClone(DEFAULT_SUPPORT_CATALOGUE)),
    ).toEqual(DEFAULT_SUPPORT_CATALOGUE);
  });
  it('projects only published information, never private AI knowledge, actor or audit details', async () => {
    process.env.SUPPORT_OPERATIONS_ENABLED =
      process.env.SUPPORT_OPERATIONS_SCHEMA_READY = 'true';
    const publicHelp = help();
    publicHelp.faqs.push({
      ...publicHelp.faqs[0],
      id: 'faq-disabled',
      enabled: false,
    });
    const config = {
      ...structuredClone(DEFAULT_SUPPORT_CATALOGUE),
      knowledge: ['Synthetic private reference'],
      publicHelp,
    };
    const db: any = {
      $queryRaw: jest.fn(async () => [
        { details: { revision: 7, actorId: 'synthetic-admin', config } },
      ]),
    };
    const service = new SupportCatalogueService(db);
    const result = await new SupportPublicController(service).help();
    expect(result.faqs).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(
      /Synthetic private reference|synthetic-admin|revision|knowledge/,
    );
    expect(result.contact?.email).toBe('help@example.invalid');
  });
  it('unpublishing hides contact and all answers even when stored', async () => {
    process.env.SUPPORT_OPERATIONS_ENABLED =
      process.env.SUPPORT_OPERATIONS_SCHEMA_READY = 'true';
    const config = {
      ...structuredClone(DEFAULT_SUPPORT_CATALOGUE),
      publicHelp: { ...help(), published: false },
    };
    const service = new SupportCatalogueService({
      $queryRaw: jest.fn(async () => [{ details: { revision: 1, config } }]),
    } as any);
    expect(await service.publicHelp()).toMatchObject({
      contact: null,
      faqs: [],
      published: false,
    });
  });
  it.each([
    { published: 'true' },
    { email: 'bad-address' },
    { faqs: [{ ...help().faqs[0], category: 'ADMIN' }] },
    { faqs: [help().faqs[0], help().faqs[0]] },
    { faqs: [{ ...help().faqs[0], answer: '<script>unsafe</script>' }] },
    { faqs: [{ ...help().faqs[0], answer: '' }] },
    { hours: 'x'.repeat(201) },
    { faqs: [{ ...help().faqs[0], answer: 'Bearer ' + 'x'.repeat(40) }] },
  ])('rejects malformed publication configuration %#', (patch) => {
    expect(() => validatePublicHelp({ ...help(), ...patch })).toThrow(
      BadRequestException,
    );
  });
  it('drops unreviewed metadata rather than allowing arbitrary public projection', () => {
    const result = validatePublicHelp({
      ...help(),
      privateNotes: 'Synthetic private note',
    });
    expect(result).not.toHaveProperty('privateNotes');
  });
});
