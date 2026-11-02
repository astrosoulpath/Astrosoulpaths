import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

describe('support mail compatibility (JSON transport, no SMTP)', () => {
  const original = process.env;
  afterEach(() => { process.env = original; });

  it.each(['created', 'reply', 'status'] as const)('preserves %s recipients and escaped content', async kind => {
    process.env = { ...original, MAIL_FROM: 'support@example.invalid', MAIL_FROM_NAME: 'Synthetic Support' };
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const send = jest.spyOn(transport, 'sendMail');
    const service = new MailService();
    // Inject a local transport; never resolve SMTP configuration or open sockets.
    Object.defineProperty(service, 'transporter', { value: transport, writable: true });
    const input = { to: 'customer@example.invalid', customerName: 'Test <Customer>', ticketNumber: 'SYN-1', subject: 'Help & guidance' };
    if (kind === 'created') await service.sendSupportTicketCreated(input);
    if (kind === 'reply') await service.sendSupportAdminReply({ ...input, message: 'नमस्ते <script>synthetic</script>' });
    if (kind === 'status') await service.sendSupportStatusChanged({ ...input, status: 'IN_PROGRESS' });
    expect(send).toHaveBeenCalledTimes(1);
    const result = await send.mock.results[0].value;
    const message = JSON.parse(String(result.message)) as { to: { address: string }[]; subject: string; html: string; text: string };
    expect(message.to.map(x => x.address)).toEqual([input.to]);
    expect(message.subject).toContain('[SYN-1]');
    expect(message.html).toContain('Test &lt;Customer&gt;');
    if (kind === 'reply') {
      expect(message.text).toContain('नमस्ते');
      expect(message.html).not.toContain('<script>');
    }
    if (kind === 'status') expect(message.subject).toContain('In Progress');
    transport.close();
  });
});
