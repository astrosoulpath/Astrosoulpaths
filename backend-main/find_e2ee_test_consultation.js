require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.callSession.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: 15,
    select: {
      id: true,
      status: true,
      userId: true,
      astrologerId: true,
      createdAt: true,
      startedAt: true,
      endedAt: true,

      user: {
        select: {
          id: true,
          phone: true,
          email: true,
          role: true,
        },
      },

      astrologer: {
        select: {
          id: true,
          phone: true,
          email: true,
          role: true,
        },
      },
    },
  });

  console.log('\n========== RECENT CONSULTATIONS ==========');

  for (const session of sessions) {
    console.log('--------------------------------');
    console.log('callSessionId :', session.id);
    console.log('status        :', session.status);
    console.log('created       :', session.createdAt);
    console.log('started       :', session.startedAt);
    console.log('ended         :', session.endedAt);

    console.log(
      'customer      :',
      session.user?.phone ||
        session.user?.email ||
        session.userId,
    );

    console.log(
      'astrologer    :',
      session.astrologer?.phone ||
        session.astrologer?.email ||
        session.astrologerId,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
