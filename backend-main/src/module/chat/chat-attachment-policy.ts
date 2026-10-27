import { BadRequestException } from '@nestjs/common';

export function assertChatAttachmentPath(
  path: string,
  callSessionId: string,
): string {
  const parts = path.split('/');
  if (
    path !== path.trim() ||
    parts.length !== 3 ||
    parts[0] !== callSessionId ||
    !['images', 'files', 'audios'].includes(parts[1]) ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(parts[2]) ||
    /[%\\?#]/.test(path)
  ) {
    throw new BadRequestException(
      'Attachment does not belong to this consultation',
    );
  }
  return path;
}

export function legacyChatAttachmentPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:sign|public)\/chat\/(.+)$/,
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
