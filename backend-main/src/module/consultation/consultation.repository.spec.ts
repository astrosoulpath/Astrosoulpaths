import { ConsultationRepository } from './consultation.repository';

describe('ConsultationRepository free chat protection', () => {
  it('uses an atomic database claim for lifetime one-time free chat', () => {
    const source =
      ConsultationRepository.prototype.createConsultation.toString();

    expect(source).toContain('freeChatUsedAt');
    expect(source).toContain('updateMany');
  });

  it('does not rely on a client supplied isFreeChat flag', () => {
    const source =
      ConsultationRepository.prototype.createConsultation.toString();

    expect(source).not.toContain('params.isFreeChat');
  });
});
