import { BadRequestException } from '@nestjs/common';

export function ownsKycDocument(
  path: unknown,
  owner: string,
  type: string,
): path is string {
  if (
    typeof path !== 'string' ||
    !owner ||
    !['identity', 'certificate', 'experience'].includes(type)
  )
    return false;
  if (
    [...path].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return false;
  const parts = path.split('/');
  return (
    parts.length === 3 &&
    parts[0] === owner &&
    parts[1] === type &&
    /^[^.%\\:?#\s][^%\\:?#\s]*\.(pdf|png|jpe?g)$/i.test(parts[2])
  );
}

export function validateKycFile(file: {
  buffer: Buffer;
  size: number;
  mimetype: string;
}) {
  if (
    !Buffer.isBuffer(file.buffer) ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size !== file.buffer.length ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new BadRequestException(
      'A non-empty KYC document of 10 MB or smaller is required',
    );
  }
  const bytes = file.buffer;
  const matches =
    file.mimetype === 'application/pdf'
      ? bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
      : ['image/jpeg', 'image/jpg'].includes(file.mimetype)
        ? bytes.length >= 3 &&
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes[2] === 0xff
        : file.mimetype === 'image/png' &&
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!matches)
    throw new BadRequestException(
      'KYC document content does not match its file type',
    );
}

export function hasOwnedIdentityProof(
  documents: unknown,
  owner: string,
): boolean {
  if (
    !documents ||
    typeof documents !== 'object' ||
    !('identityProof' in documents)
  )
    return false;
  const proof = documents.identityProof;
  return (
    !!proof &&
    typeof proof === 'object' &&
    'url' in proof &&
    'type' in proof &&
    proof.type === 'identity' &&
    'name' in proof &&
    typeof proof.name === 'string' &&
    !!proof.name.trim() &&
    ownsKycDocument(proof.url, owner, 'identity')
  );
}
