import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Resolve the same table/search_path as Prisma. Never infer schema from a URL,
// environment label, a failed write, or a caught P2022 inside a transaction.
export async function hasLiveV2Schema(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
) {
  const rows = await db.$queryRaw<
    Array<{ protocol: boolean; host: boolean; connections: boolean }>
  >`
    SELECT
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('"LiveSession"') AND attname = 'connectionProtocol' AND NOT attisdropped) AS protocol,
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('"LiveSession"') AND attname = 'hostConnectionId' AND NOT attisdropped) AS host,
      to_regclass('"LiveConnection"') IS NOT NULL AS connections
  `;
  const row = rows[0];
  if (
    !row ||
    [row.protocol, row.host, row.connections].some(
      (value) => typeof value !== 'boolean',
    )
  ) {
    throw new ServiceUnavailableException(
      'Live schema capabilities unavailable',
    );
  }
  if (!row.protocol && !row.host && !row.connections) return false;
  if (row.protocol && row.host && row.connections) return true;
  throw new ServiceUnavailableException(
    'Incomplete Live migration; Live unavailable',
  );
}

export const legacySessionSelect = {
  id: true,
  astrologerId: true,
  channelName: true,
  title: true,
  status: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
