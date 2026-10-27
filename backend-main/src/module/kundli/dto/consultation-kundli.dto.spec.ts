import { ValidationPipe } from '@nestjs/common';
import { GenerateConsultationKundliDto, GrantConsultationKundliDto } from './consultation-kundli.dto';
import { ConsultationKundliErrorFilter } from '../consultation-kundli-error.filter';
import { ForbiddenException } from '@nestjs/common';

describe('consultation Kundli strict request contract', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const grant = { accepted: true, policyVersion: 'kundli-local-v1' };
  const generate = { requestKey: '51e1009e-f95e-4898-a865-6c6f336791fc', lang: 'en' };
  const validate = (body: unknown, metatype: any) => pipe.transform(body, { type: 'body', metatype });
  it('accepts the existing Flutter grant and generation contracts', async () => {
    await expect(validate(grant, GrantConsultationKundliDto)).resolves.toMatchObject(grant);
    await expect(validate(generate, GenerateConsultationKundliDto)).resolves.toMatchObject(generate);
  });
  it.each(['customerUserId', 'astrologerId', 'birthProfileId', 'dob', 'subscriptionId', 'entitled'])('rejects client-supplied %s rather than silently ignoring it', async key => {
    await expect(validate({ ...generate, [key]: 'foreign' }, GenerateConsultationKundliDto)).rejects.toThrow();
  });
  it.each([{ accepted: 'true' }, { policyVersion: 'old' }, { accepted: false }])('rejects implicit or obsolete consent %j', async change => {
    await expect(validate({ ...grant, ...change }, GrantConsultationKundliDto)).rejects.toThrow();
  });
  it.each([{ requestKey: 'replay' }, { lang: 'unsupported' }])('rejects invalid generation %j', async change => {
    await expect(validate({ ...generate, ...change }, GenerateConsultationKundliDto)).rejects.toThrow();
  });
  it('does not serialize engine, SQL, profile or credential exception text', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    new ConsultationKundliErrorFilter().catch(new Error('secret token birthDate postgresql://private'), { switchToHttp: () => ({ getResponse: () => response }) } as never);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(response.json.mock.calls)).not.toMatch(/secret|token|birthDate|postgresql|private/);
  });
  it('preserves an explicit authorization denial', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    new ConsultationKundliErrorFilter().catch(new ForbiddenException('Access denied'), { switchToHttp: () => ({ getResponse: () => response }) } as never);
    expect(response.status).toHaveBeenCalledWith(403);
  });
});
