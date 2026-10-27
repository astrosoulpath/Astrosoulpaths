jest.mock('../../infrastructure/supabase/supabase.service', () => ({
  SupabaseService: class {},
}));
import {
  resolveSupportActor,
  supportPage,
  supportText,
  supportDuplicate,
} from './support-policy';
import {
  supportDeliveryEnabled,
  SupportDeliveryWorker,
} from './support-delivery.worker';
import { supportOperationsEnabled, auditSupport } from './support-operations';
import { SupportAttachmentService } from './support-attachment.service';
import { SupportService } from './support.service';
import { SupportAdminService } from './support-admin.service';
import { FeedbackService } from '../feedback/feedback.service';
import {SupportErrorFilter} from './support-error.filter';
import {ForbiddenException} from '@nestjs/common';

describe('Support/feedback authorization and delivery', () => {
  it('closed ticket attachments are rejected before storage access',async()=>{const storage={getStorageClient:jest.fn()};const service=new SupportAttachmentService({supportTicket:{findFirst:async()=>({id:'ticket',status:'CLOSED'})}} as never,storage as never);await expect(service.uploadForCustomer('ticket','owner',{buffer:Buffer.from('a'),size:1,mimetype:'text/plain',originalname:'note.txt'} as never)).rejects.toThrow('Closed');expect(storage.getStorageClient).not.toHaveBeenCalled();});
  it('never exposes raw database or provider failures',()=>{let status:number|undefined,body:unknown;const response={status:(code:number)=>{status=code;return response;},json:(data:unknown)=>{body=data;}};new SupportErrorFilter().catch({code:'private-token',message:'postgresql://secret password private message'}, {switchToHttp:()=>({getResponse:()=>response})} as never);expect(status).toBe(503);expect(JSON.stringify(body)).not.toMatch(/secret|password|token|postgresql/);});
  it('retains authorization denial status',()=>{const response={status:jest.fn().mockReturnThis(),json:jest.fn()};new SupportErrorFilter().catch(new ForbiddenException('Access denied'),{switchToHttp:()=>({getResponse:()=>response})} as never);expect(response.status).toHaveBeenCalledWith(403);});
  it('uploads validated image bytes to private ticket-owned storage with MIME-derived extension',async()=>{
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=','base64');
    const upload=jest.fn().mockResolvedValue({error:null});const create=jest.fn().mockImplementation(async input=>({id:'attachment',...input.data}));
    const tx={$queryRaw:jest.fn(),supportTicket:{findFirst:async()=>({id:'ticket',status:'OPEN'}),update:jest.fn()},supportAttachment:{create}};
    const service=new SupportAttachmentService({...tx,$transaction:async fn=>fn(tx)} as never,{getStorageClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from:()=>({upload})}})} as never);
    await service.uploadForCustomer('ticket','owner',{buffer:bytes,size:bytes.length,mimetype:'image/png',originalname:'untrusted.html'} as never);
    expect(upload.mock.calls[0][0]).toMatch(/^owner\/ticket\/[a-f0-9-]+\.png$/);
    expect(create.mock.calls[0][0].data).toMatchObject({ticketId:'ticket',storageBucket:'support',contentType:'image/png'});
  });
  it('signs only bound stored metadata with short expiry and forced download',async()=>{
    const findFirst=jest.fn().mockResolvedValue({id:'attachment'}),sign=jest.fn().mockResolvedValue({data:{signedUrl:'https://synthetic.invalid/file'}});
    const service=new SupportAttachmentService({supportAttachment:{findFirst}} as never,{getStorageClient:()=>({storage:{getBucket:async()=>({data:{public:false}}),from:()=>({createSignedUrl:sign})}})} as never);
    expect(await service.createSignedUrl('support','legacy-private-path','ticket')).toBe('https://synthetic.invalid/file');expect(findFirst.mock.calls[0][0].where).toEqual({ticketId:'ticket',storageBucket:'support',storagePath:'legacy-private-path'});expect(sign).toHaveBeenCalledWith('legacy-private-path',120,{download:true});
  });
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    jest.clearAllMocks();
  });
  const user = {
    id: 'owner',
    supabaseId: 'subject',
    isActive: true,
    isBlocked: false,
    role: { name: 'CUSTOMER' },
    astrologer: null,
  };
  it.each([{}, { email: 'selected@example.invalid' }, { phone: '+000' }])(
    'never resolves accounts from contact data',
    async (auth) => {
      await expect(resolveSupportActor({}, auth)).rejects.toThrow();
    },
  );
  it('resolves only one active canonical subject without account writes', async () => {
    const db = { user: { findMany: jest.fn().mockResolvedValue([user]) } };
    expect((await resolveSupportActor(db, { sub: 'subject' })).id).toBe(
      'owner',
    );
    expect(db.user.findMany.mock.calls[0][0].where.OR[0]).toEqual({
      supabaseId: 'subject',
    });
  });
  it.each([
    { users: [{ ...user, isBlocked: true }] },
    { users: [{ ...user, isActive: false }] },
    { users: [user, user] },
    { users: [] },
  ])(
    'rejects blocked disabled ambiguous and unmapped actors',
    async ({ users }) => {
      await expect(
        resolveSupportActor(
          { user: { findMany: async () => users } },
          { sub: 'subject' },
        ),
      ).rejects.toThrow();
    },
  );
  it('rejects canonical identity disagreement', async () => {
    await expect(
      resolveSupportActor(
        { user: { findMany: async () => [user] } },
        { sub: 'subject', asp_user_id: 'foreign' },
      ),
    ).rejects.toThrow();
  });
  it('requires approved astrologer and Admin role separately', async () => {
    await expect(
      resolveSupportActor(
        {
          user: {
            findMany: async () => [{ ...user, role: { name: 'ASTROLOGER' } }],
          },
        },
        { sub: 'subject' },
      ),
    ).rejects.toThrow();
    await expect(
      resolveSupportActor(
        { user: { findMany: async () => [user] } },
        { sub: 'subject' },
        true,
      ),
    ).rejects.toThrow();
  });
  it.each([
    { page: NaN },
    { page: 0 },
    { limit: 101 },
    { limit: Infinity },
    { status: 'wrong' },
    { priority: 'wrong' },
    { search: 'x'.repeat(161) },
  ])('rejects unsafe query %p', (input) => {
    expect(() => supportPage(input)).toThrow();
  });
  it('bounds valid search and pagination', () => {
    expect(supportPage({ page: 2, limit: 25, search: ' hello ' })).toEqual({
      page: 2,
      limit: 25,
      search: 'hello',
    });
  });
  it.each(['', '   ', 'x'.repeat(5001)])(
    'rejects blank or oversized content',
    (value) => {
      expect(() => supportText(value, 5000)).toThrow();
    },
  );
  it('rejects cross-ticket reuse of message idempotency keys', async () => {
    await expect(
      supportDuplicate(
        {
          supportMessage: { findFirst: async () => ({ ticketId: 'foreign' }) },
        } as never,
        'owner',
        'ticket',
        'key',
      ),
    ).rejects.toThrow('another ticket');
  });
  it('delivery and operations default OFF before database access', async () => {
    delete process.env.SUPPORT_OPERATIONS_ENABLED;
    delete process.env.SUPPORT_OPERATIONS_SCHEMA_READY;
    expect(supportOperationsEnabled()).toBe(false);
    expect(supportDeliveryEnabled()).toBe(false);
    await new SupportDeliveryWorker({} as never, {} as never).tick();
    await auditSupport({} as never, 'actor', 'TICKET', 'ticket', 'CREATED');
  });
  it.each(['true', 'invalid'])('emergency stop fails closed %s', (value) => {
    process.env.SUPPORT_OPERATIONS_ENABLED = 'true';
    process.env.SUPPORT_OPERATIONS_SCHEMA_READY = 'true';
    process.env.SUPPORT_NOTIFICATIONS_ENABLED = 'true';
    process.env.SUPPORT_NOTIFICATIONS_EMERGENCY_DISABLED = value;
    expect(supportDeliveryEnabled()).toBe(false);
  });
  it('never signs arbitrary buckets or foreign-ticket paths', async () => {
    const storage = { getStorageClient: jest.fn() };
    const service = new SupportAttachmentService(
      {
        supportAttachment: { findFirst: jest.fn().mockResolvedValue(null) },
      } as never,
      storage as never,
    );
    await expect(
      service.createSignedUrl('public', 'foreign', 'ticket'),
    ).rejects.toThrow();
    await expect(
      service.createSignedUrl('support', 'foreign', 'ticket'),
    ).rejects.toThrow();
    expect(storage.getStorageClient).not.toHaveBeenCalled();
  });
  it('rejects spoofed MIME before provider access', async () => {
    const storage = { getStorageClient: jest.fn() };
    const service = new SupportAttachmentService(
      { supportTicket: { findFirst: async () => ({ id: 'ticket' }) } } as never,
      storage as never,
    );
    await expect(
      service.uploadForCustomer('ticket', 'owner', {
        buffer: Buffer.from('MZbad'),
        size: 5,
        mimetype: 'image/png',
        originalname: 'fake.png',
      } as never),
    ).rejects.toThrow('content');
    expect(storage.getStorageClient).not.toHaveBeenCalled();
  });
  it('rejects public support storage', async () => {
    const service = new SupportAttachmentService(
      {
        supportAttachment: { findFirst: async () => ({ id: 'attachment' }) },
      } as never,
      {
        getStorageClient: () => ({
          storage: { getBucket: async () => ({ data: { public: true } }) },
        }),
      } as never,
    );
    await expect(
      service.createSignedUrl('support', 'path', 'ticket'),
    ).rejects.toThrow('Private support storage');
  });
  it('owned list query always includes sender scope and bounded page', async () => {
    const db = {
      user: { findMany: async () => [user] },
      supportTicket: {
        findMany: jest.fn().mockResolvedValue([]),
        count: async () => 0,
      },
    };
    const result = await new SupportService(
      db as never,
      {} as never,
      {} as never,
    ).getMyTickets({ sub: 'subject' }, { page: 2, limit: 10 });
    expect(result.tickets).toEqual([]);
    expect(db.supportTicket.findMany.mock.calls[0][0]).toMatchObject({
      where: { customerId: 'owner' },
      skip: 10,
      take: 10,
    });
  });
  it('customer cannot read foreign ticket', async () => {
    const db = {
      user: { findMany: async () => [user] },
      supportTicket: { findFirst: async () => null },
    };
    await expect(
      new SupportService(db as never, {} as never, {} as never).getMyTicket(
        { sub: 'subject' },
        'foreign',
      ),
    ).rejects.toThrow();
  });
  it('feedback cannot be submitted by astrologer even when approved', async () => {
    const db = {
      user: {
        findMany: async () => [
          {
            ...user,
            role: { name: 'ASTROLOGER' },
            astrologer: { isApproved: true },
          },
        ],
      },
    };
    await expect(
      new FeedbackService(db as never).create('subject', {
        category: 'GENERAL',
        message: 'hello',
      }),
    ).rejects.toThrow('customer');
  });
  it('Admin list rejects malformed filters before querying', async () => {
    await expect(
      new SupportAdminService({} as never, {} as never, {} as never).getTickets(
        { page: NaN },
      ),
    ).rejects.toThrow('pagination');
  });
});
