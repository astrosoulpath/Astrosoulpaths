const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: 'default' }
  });

  const videoCalls = await prisma.callSession.findMany({
    where: {
      mode: {
        equals: 'video',
        mode: 'insensitive'
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
    select: {
      id: true,
      userId: true,
      astrologerId: true,
      channelName: true,
      mode: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      endedAt: true
    }
  });

  console.log('VIDEO_ADMIN_SETTING:', {
    exists: !!settings,
    enabled: settings?.videoCallEnabled
  });

  console.log('RECENT_VIDEO_CALLS:', videoCalls);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.();
  });