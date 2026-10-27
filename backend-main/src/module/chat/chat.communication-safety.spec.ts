import { ChatService } from './chat.service';
import { assertChatAttachmentPath } from './chat-attachment-policy';

describe('consultation attachment isolation (mock storage/database)', () => {
  let service: any, storage: any;
  beforeEach(() => {
    storage = {
      from: jest.fn().mockReturnThis(),
      createSignedUrl: jest
        .fn()
        .mockResolvedValue({
          data: { signedUrl: 'https://fixture.invalid/safe' },
          error: null,
        }),
    };
    service = new ChatService(
      {} as any,
      {} as any,
      { getStorageClient: () => ({ storage }) } as any,
    );
  });
  it('signs only a path inside the authorized consultation', async () => {
    expect(
      await service.createAttachmentAccessUrl(
        'session/images/file.jpg',
        null,
        'session',
      ),
    ).toBe('https://fixture.invalid/safe');
    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      'session/images/file.jpg',
      600,
    );
  });
  it.each([
    'foreign/images/file.jpg',
    'session/../file.jpg',
    'session/images/%2e.jpg',
    'session/images/folder/file.jpg',
    'session\\images\\file.jpg',
  ])('never signs unsafe path %s', async (path) => {
    expect(
      await service.createAttachmentAccessUrl(path, null, 'session'),
    ).toBeNull();
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it('rejects foreign legacy signed URL but preserves same-session historical access', async () => {
    const base = 'https://fixture.invalid/storage/v1/object/sign/chat/';
    expect(
      await service.createAttachmentAccessUrl(
        null,
        base + 'foreign/images/file.jpg?token=fixture',
        'session',
      ),
    ).toBeNull();
    expect(
      await service.createAttachmentAccessUrl(
        null,
        base + 'session/images/file.jpg?token=fixture',
        'session',
      ),
    ).toContain('session/images');
  });
  it('new-message path validation rejects a foreign session', () => {
    expect(() =>
      assertChatAttachmentPath('foreign/images/file.jpg', 'session'),
    ).toThrow();
  });
  it('unauthorized participant cannot trigger history signing', async () => {
    jest
      .spyOn(service, 'getAuthenticatedUser')
      .mockResolvedValue({ id: 'foreign' });
    jest
      .spyOn(service, 'getAccessibleCallSession')
      .mockRejectedValue(new Error('not participant'));
    await expect(service.getChatHistory('subject', 'session')).rejects.toThrow(
      'not participant',
    );
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it('rejects foreign path before inserting a submitted message', async () => {
    service.prisma = { chatMessage: { create: jest.fn() } };
    jest
      .spyOn(service, 'getAuthenticatedUser')
      .mockResolvedValue({ id: 'customer' });
    jest
      .spyOn(service, 'getAccessibleCallSession')
      .mockResolvedValue({
        id: 'session',
        user: { id: 'customer' },
        astrologer: { id: 'astro' },
      });
    jest
      .spyOn(service, 'assertParticipantsCanInteract')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'assertCallIsActive').mockImplementation(() => {});
    jest.spyOn(service, 'validateMessagePayload').mockImplementation(() => {});
    await expect(
      service.sendMessage('subject', {
        messageType: 'IMAGE',
        attachmentPath: 'foreign/images/file.jpg',
      }),
    ).rejects.toThrow('Attachment');
    expect(service.prisma.chatMessage.create).not.toHaveBeenCalled();
  });
});
