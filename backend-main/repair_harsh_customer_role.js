require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HARSH_ID = 'f03ed02d-5de0-42f1-8315-387fbfbf971d';
const ROHAN_ID = '5b1b3043-3f6d-498b-8975-90675e144317';

async function main() {
  const customerRole = await prisma.role.findFirst({
    where: {
      name: 'CUSTOMER',
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!customerRole) {
    throw new Error('STOP: CUSTOMER role does not exist.');
  }

  console.log('CUSTOMER ROLE:', customerRole);

  const harsh = await prisma.user.findUnique({
    where: {
      id: HARSH_ID,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      roleId: true,
      isAstrologer: true,
      astrologer: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  const rohan = await prisma.user.findUnique({
    where: {
      id: ROHAN_ID,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      roleId: true,
      isAstrologer: true,
    },
  });

  console.log('\n--- BEFORE ---');
  console.dir({ harsh, rohan }, { depth: null });

  if (!harsh || harsh.phone !== '+918651540070') {
    throw new Error('STOP: Harsh identity mismatch.');
  }

  if (!rohan || rohan.phone !== '+918651542245') {
    throw new Error('STOP: Rohan identity mismatch.');
  }

  const harshAsCustomer = await prisma.callSession.count({
    where: {
      userId: HARSH_ID,
    },
  });

  const harshAsAstrologer = await prisma.callSession.count({
    where: {
      astrologerId: HARSH_ID,
    },
  });

  console.log('\nHarsh customer consultations   :', harshAsCustomer);
  console.log('Harsh astrologer consultations :', harshAsAstrologer);

  if (harshAsAstrologer > 0) {
    throw new Error(
      'STOP: Harsh also has consultations as astrologer. Do not auto-repair.',
    );
  }

  const updated = await prisma.user.update({
    where: {
      id: HARSH_ID,
    },
    data: {
      roleId: customerRole.id,
      isAstrologer: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      roleId: true,
      isAstrologer: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log('\n--- AFTER ---');
  console.dir(updated, { depth: null });

  if (
    updated.roleId !== customerRole.id ||
    updated.isAstrologer !== false
  ) {
    throw new Error('STOP: customer role repair verification failed.');
  }

  console.log('\nHARSH CUSTOMER IDENTITY REPAIRED SUCCESSFULLY');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
